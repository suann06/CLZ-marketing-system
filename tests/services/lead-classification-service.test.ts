import { describe, expect, it, vi, beforeEach } from "vitest";

// Prisma AND the AI provider are fully mocked — these tests never touch the
// real Supabase database or call any real AI service. The mocked prisma
// client below deliberately exposes only the exact methods
// lead-classification-service.ts is documented to use — no `lead.create`,
// no `whatsAppThread.create`, no `whatsAppMessage.create` — if this service
// ever tried to create a Lead/Thread/Message, the call would fail loudly
// with "is not a function", a structural guarantee this service only ever
// reads conversation state and writes Lead.status/LeadStatusHistory.
const {
  leadFindUnique,
  leadUpdate,
  threadFindUnique,
  campaignFindUnique,
  messageFindMany,
  leadStatusHistoryCreate,
  logActivityMock,
  classifyLeadMock,
} = vi.hoisted(() => ({
  leadFindUnique: vi.fn(),
  leadUpdate: vi.fn(),
  threadFindUnique: vi.fn(),
  campaignFindUnique: vi.fn(),
  messageFindMany: vi.fn(),
  leadStatusHistoryCreate: vi.fn(),
  logActivityMock: vi.fn(),
  classifyLeadMock: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    lead: { findUnique: leadFindUnique, update: leadUpdate },
    whatsAppThread: { findUnique: threadFindUnique },
    campaign: { findUnique: campaignFindUnique },
    whatsAppMessage: { findMany: messageFindMany },
    leadStatusHistory: { create: leadStatusHistoryCreate },
  },
}));

vi.mock("@/lib/actor", () => ({
  logActivity: logActivityMock,
}));

vi.mock("@/server/providers/ai/provider-registry", () => ({
  getAiProvider: () => ({ providerName: "mock-ai", converse: vi.fn(), classifyLead: classifyLeadMock }),
}));

import {
  classifyLead,
  LeadClassificationAiError,
} from "@/server/services/lead-classification-service";
import {
  LeadNotFoundError,
  ThreadNotFoundError,
  ThreadLeadMismatchError,
} from "@/server/services/conversation-service";

const THREAD = { id: "thread-1", leadId: "lead-1", provider: "stub", externalThreadId: "ext-thread-1" };

const CAMPAIGN = {
  productPromotion: "Unlimited Fibre Plan",
  officialPricing: { amount: 99, currency: "MYR" },
  differentiators: ["fast install"],
};

function lead(status: string, customerInfo: Record<string, unknown> = {}) {
  return { id: "lead-1", campaignId: "c1", phone: "+60123456789", status, customerInfo };
}

function messagesWithInbound(content: string) {
  return [
    { id: "msg-2", threadId: "thread-1", direction: "inbound", content, createdAt: new Date("2024-01-02") },
    { id: "msg-1", threadId: "thread-1", direction: "outbound", content: "Hi! How can I help?", createdAt: new Date("2024-01-01") },
  ];
}

describe("classifyLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    threadFindUnique.mockResolvedValue(THREAD);
    campaignFindUnique.mockResolvedValue(CAMPAIGN);
    leadUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...lead("new"),
      ...data,
    }));
    leadStatusHistoryCreate.mockResolvedValue({ id: "history-1" });
  });

  describe("status transitions", () => {
    const cases: [string, string, string][] = [
      ["new", "I want to sign up, how do I apply?", "hot"],
      ["new", "How much does this cost and what's the coverage?", "warm"],
      ["new", "Not interested, please don't message me again", "cold"],
      ["warm", "I'm ready to apply now, please register me", "hot"],
      ["hot", "Actually just tell me more about pricing first", "warm"],
      ["hot", "No thanks, not interested anymore", "cold"],
      ["cold", "Can you tell me more about the package details?", "warm"],
      ["cold", "I've decided, please sign me up now", "hot"],
    ];

    it.each(cases)("moves a %s Lead to %s given a matching message (-> %s)", async (from, content, expected) => {
      leadFindUnique.mockResolvedValue(lead(from));
      messageFindMany.mockResolvedValue(messagesWithInbound(content));
      classifyLeadMock.mockResolvedValue({ classification: expected, reason: `Derived from: "${content}"` });

      const result = await classifyLead({ leadId: "lead-1", threadId: "thread-1" });

      expect(result.classified).toBe(true);
      expect(result.status).toBe(expected);
      expect(leadUpdate).toHaveBeenCalledWith({ where: { id: "lead-1" }, data: { status: expected } });
    });
  });

  describe("insufficient signal", () => {
    it("leaves a new Lead as new when the only inbound message is a bare greeting", async () => {
      leadFindUnique.mockResolvedValue(lead("new"));
      messageFindMany.mockResolvedValue(messagesWithInbound("Hi"));

      const result = await classifyLead({ leadId: "lead-1", threadId: "thread-1" });

      expect(result.classified).toBe(false);
      expect(result.status).toBe("new");
      expect(classifyLeadMock).not.toHaveBeenCalled();
      expect(leadUpdate).not.toHaveBeenCalled();
      expect(leadStatusHistoryCreate).not.toHaveBeenCalled();
    });

    it("does not force new -> cold just because there is no purchase intent yet", async () => {
      leadFindUnique.mockResolvedValue(lead("new"));
      messageFindMany.mockResolvedValue(messagesWithInbound("ok"));

      const result = await classifyLead({ leadId: "lead-1", threadId: "thread-1" });

      expect(result.status).toBe("new");
      expect(leadUpdate).not.toHaveBeenCalled();
    });
  });

  describe("same-status classification", () => {
    it.each(["warm", "hot", "cold"])("does not create a history row for %s -> %s", async (status) => {
      leadFindUnique.mockResolvedValue(lead(status));
      messageFindMany.mockResolvedValue(messagesWithInbound("Tell me more about pricing please"));
      classifyLeadMock.mockResolvedValue({ classification: status, reason: "Same as before." });

      const result = await classifyLead({ leadId: "lead-1", threadId: "thread-1" });

      expect(result.classified).toBe(true);
      expect(result.changed).toBe(false);
      expect(leadUpdate).not.toHaveBeenCalled();
      expect(leadStatusHistoryCreate).not.toHaveBeenCalled();
    });
  });

  describe("LeadStatusHistory", () => {
    it("creates exactly one history row for a real status change", async () => {
      leadFindUnique.mockResolvedValue(lead("warm"));
      messageFindMany.mockResolvedValue(messagesWithInbound("I want to apply now, please register me"));
      classifyLeadMock.mockResolvedValue({
        classification: "hot",
        reason: "Customer explicitly requested to apply.",
      });

      await classifyLead({ leadId: "lead-1", threadId: "thread-1" });

      expect(leadStatusHistoryCreate).toHaveBeenCalledTimes(1);
    });

    it("records the correct fromStatus, toStatus, reason, and actorType", async () => {
      leadFindUnique.mockResolvedValue(lead("warm"));
      messageFindMany.mockResolvedValue(messagesWithInbound("I want to apply now, please register me"));
      classifyLeadMock.mockResolvedValue({
        classification: "hot",
        reason: "Customer explicitly requested to apply.",
      });

      await classifyLead({ leadId: "lead-1", threadId: "thread-1" });

      expect(leadStatusHistoryCreate).toHaveBeenCalledWith({
        data: {
          leadId: "lead-1",
          fromStatus: "warm",
          toStatus: "hot",
          reason: "Customer explicitly requested to apply.",
          actorType: "ai",
          actorId: null,
        },
      });
    });
  });

  describe("conversation context", () => {
    it("loads the correct Lead by id", async () => {
      leadFindUnique.mockResolvedValue(lead("new"));
      messageFindMany.mockResolvedValue(messagesWithInbound("I want to apply now please"));
      classifyLeadMock.mockResolvedValue({ classification: "hot", reason: "ok" });

      await classifyLead({ leadId: "lead-1", threadId: "thread-1" });

      expect(leadFindUnique).toHaveBeenCalledWith({ where: { id: "lead-1" } });
    });

    it("loads the correct Thread by id", async () => {
      leadFindUnique.mockResolvedValue(lead("new"));
      messageFindMany.mockResolvedValue(messagesWithInbound("I want to apply now please"));
      classifyLeadMock.mockResolvedValue({ classification: "hot", reason: "ok" });

      await classifyLead({ leadId: "lead-1", threadId: "thread-1" });

      expect(threadFindUnique).toHaveBeenCalledWith({ where: { id: "thread-1" } });
    });

    it("loads campaign context from the Lead's own campaignId", async () => {
      leadFindUnique.mockResolvedValue(lead("new"));
      messageFindMany.mockResolvedValue(messagesWithInbound("I want to apply now please"));
      classifyLeadMock.mockResolvedValue({ classification: "hot", reason: "ok" });

      await classifyLead({ leadId: "lead-1", threadId: "thread-1" });

      expect(campaignFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "c1" } }),
      );
    });

    it("scopes conversation messages strictly to the given thread, never another campaign/Lead", async () => {
      leadFindUnique.mockResolvedValue(lead("new"));
      messageFindMany.mockResolvedValue(messagesWithInbound("I want to apply now please"));
      classifyLeadMock.mockResolvedValue({ classification: "hot", reason: "ok" });

      await classifyLead({ leadId: "lead-1", threadId: "thread-1" });

      expect(messageFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { threadId: "thread-1" } }),
      );
    });

    it("throws ThreadLeadMismatchError when the thread belongs to a different Lead (never classifies across leads)", async () => {
      leadFindUnique.mockResolvedValue(lead("new"));
      threadFindUnique.mockResolvedValue({ ...THREAD, leadId: "other-lead" });

      await expect(
        classifyLead({ leadId: "lead-1", threadId: "thread-1" }),
      ).rejects.toBeInstanceOf(ThreadLeadMismatchError);
      expect(classifyLeadMock).not.toHaveBeenCalled();
    });

    it("throws LeadNotFoundError when the Lead does not exist", async () => {
      leadFindUnique.mockResolvedValue(null);
      await expect(
        classifyLead({ leadId: "missing", threadId: "thread-1" }),
      ).rejects.toBeInstanceOf(LeadNotFoundError);
    });

    it("throws ThreadNotFoundError when the Thread does not exist", async () => {
      leadFindUnique.mockResolvedValue(lead("new"));
      threadFindUnique.mockResolvedValue(null);
      await expect(
        classifyLead({ leadId: "lead-1", threadId: "missing" }),
      ).rejects.toBeInstanceOf(ThreadNotFoundError);
    });
  });

  describe("AI output validation", () => {
    it("accepts a valid classification", async () => {
      leadFindUnique.mockResolvedValue(lead("new"));
      messageFindMany.mockResolvedValue(messagesWithInbound("I want to apply now please"));
      classifyLeadMock.mockResolvedValue({ classification: "hot", reason: "Customer wants to apply." });

      const result = await classifyLead({ leadId: "lead-1", threadId: "thread-1" });
      expect(result.classified).toBe(true);
    });

    it("rejects an invalid classification shape (missing reason)", async () => {
      leadFindUnique.mockResolvedValue(lead("new"));
      messageFindMany.mockResolvedValue(messagesWithInbound("I want to apply now please"));
      classifyLeadMock.mockResolvedValue({ classification: "hot" });

      await expect(
        classifyLead({ leadId: "lead-1", threadId: "thread-1" }),
      ).rejects.toBeInstanceOf(LeadClassificationAiError);
      expect(leadUpdate).not.toHaveBeenCalled();
    });

    it.each(["qualified", "interested", "very_hot", "new"])(
      "rejects an unsupported classification value: %s",
      async (badValue) => {
        leadFindUnique.mockResolvedValue(lead("new"));
        messageFindMany.mockResolvedValue(messagesWithInbound("I want to apply now please"));
        classifyLeadMock.mockResolvedValue({ classification: badValue, reason: "some reason" });

        await expect(
          classifyLead({ leadId: "lead-1", threadId: "thread-1" }),
        ).rejects.toBeInstanceOf(LeadClassificationAiError);
        expect(leadUpdate).not.toHaveBeenCalled();
      },
    );

    it("propagates an AI provider failure as LeadClassificationAiError", async () => {
      leadFindUnique.mockResolvedValue(lead("new"));
      messageFindMany.mockResolvedValue(messagesWithInbound("I want to apply now please"));
      classifyLeadMock.mockRejectedValue(new Error("provider timeout"));

      await expect(
        classifyLead({ leadId: "lead-1", threadId: "thread-1" }),
      ).rejects.toBeInstanceOf(LeadClassificationAiError);
      expect(leadUpdate).not.toHaveBeenCalled();
    });
  });

  describe("state ownership", () => {
    it("the AI provider's mock never touches prisma — only the service mutates Lead.status", async () => {
      leadFindUnique.mockResolvedValue(lead("new"));
      messageFindMany.mockResolvedValue(messagesWithInbound("I want to apply now please"));
      classifyLeadMock.mockResolvedValue({ classification: "hot", reason: "Customer wants to apply." });

      await classifyLead({ leadId: "lead-1", threadId: "thread-1" });

      // classifyLeadMock is a bare vi.fn() with no access to prisma at
      // all — the only way Lead.status changes is through leadUpdate,
      // called directly by this service.
      expect(leadUpdate).toHaveBeenCalledTimes(1);
    });
  });
});
