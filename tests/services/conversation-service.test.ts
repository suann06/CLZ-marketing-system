import { describe, expect, it, vi, beforeEach } from "vitest";

// Prisma AND both providers (AI, WhatsApp) are fully mocked — these tests
// never touch the real Supabase database or call any real AI/WhatsApp
// service. The mocked prisma client below deliberately exposes only the
// exact methods conversation-service.ts is documented to use — no
// `lead.create`, no `whatsAppThread.create`, no `campaign.update` — so if
// this service ever tried to create a Lead/Thread or mutate the Campaign,
// the call would fail loudly with "is not a function".
const {
  leadFindUnique,
  leadUpdate,
  threadFindUnique,
  campaignFindUnique,
  messageFindMany,
  messageCreate,
  messageUpdate,
  logActivityMock,
  converseMock,
  sendMock,
  callOrder,
} = vi.hoisted(() => ({
  leadFindUnique: vi.fn(),
  leadUpdate: vi.fn(),
  threadFindUnique: vi.fn(),
  campaignFindUnique: vi.fn(),
  messageFindMany: vi.fn(),
  messageCreate: vi.fn(),
  messageUpdate: vi.fn(),
  logActivityMock: vi.fn(),
  converseMock: vi.fn(),
  sendMock: vi.fn(),
  callOrder: [] as string[],
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    lead: { findUnique: leadFindUnique, update: leadUpdate },
    whatsAppThread: { findUnique: threadFindUnique },
    campaign: { findUnique: campaignFindUnique },
    whatsAppMessage: { findMany: messageFindMany, create: messageCreate, update: messageUpdate },
  },
}));

vi.mock("@/lib/actor", () => ({
  logActivity: logActivityMock,
}));

vi.mock("@/server/providers/ai/provider-registry", () => ({
  getAiProvider: () => ({ providerName: "mock-ai", converse: converseMock }),
}));

vi.mock("@/server/providers/whatsapp/provider-registry", () => ({
  getWhatsAppProvider: () => ({ providerName: "mock-whatsapp", send: sendMock }),
}));

import {
  processInboundMessage,
  ConversationAiError,
  LeadNotFoundError,
  ThreadNotFoundError,
  ThreadLeadMismatchError,
  NoInboundMessageError,
} from "@/server/services/conversation-service";

const LEAD = {
  id: "lead-1",
  campaignId: "c1",
  phone: "+60123456789",
  customerInfo: { name: "Jane" } as Record<string, unknown>,
  status: "new",
};

const THREAD = { id: "thread-1", leadId: "lead-1", provider: "stub", externalThreadId: "ext-thread-1" };

const CAMPAIGN = {
  productPromotion: "Unlimited Fibre Plan",
  officialPricing: { amount: 99, currency: "MYR" },
  differentiators: ["fast install"],
};

// desc order (newest first) — matches the orderBy: { createdAt: "desc" }
// query conversation-service.ts issues.
const RECENT_DESC = [
  { id: "msg-3", threadId: "thread-1", direction: "inbound", content: "Yes, tell me more", createdAt: new Date("2024-01-03") },
  { id: "msg-2", threadId: "thread-1", direction: "outbound", content: "Hi! How can I help?", createdAt: new Date("2024-01-02") },
  { id: "msg-1", threadId: "thread-1", direction: "inbound", content: "Hello", createdAt: new Date("2024-01-01") },
];

const VALID_AI_OUTPUT = {
  response: "Sure! May I know which area you're staying in?",
  customerInfo: { name: null, location: "Petaling Jaya", currentProvider: null, interest: null },
};

describe("processInboundMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;

    leadFindUnique.mockResolvedValue(LEAD);
    threadFindUnique.mockResolvedValue(THREAD);
    campaignFindUnique.mockResolvedValue(CAMPAIGN);
    messageFindMany.mockResolvedValue(RECENT_DESC);
    converseMock.mockImplementation(async () => {
      callOrder.push("converse");
      return VALID_AI_OUTPUT;
    });
    messageCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      callOrder.push("messageCreate");
      return { id: "outbound-1", createdAt: new Date(), ...data };
    });
    messageUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      callOrder.push("messageUpdate");
      return { id: "outbound-1", threadId: "thread-1", leadId: "lead-1", ...data };
    });
    sendMock.mockImplementation(async () => {
      callOrder.push("send");
      return { success: true, externalMessageId: "stub-message-thread-1-123" };
    });
    leadUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...LEAD,
      ...data,
    }));
  });

  describe("conversation context", () => {
    it("loads the correct Lead by id", async () => {
      await processInboundMessage({ leadId: "lead-1", threadId: "thread-1" });
      expect(leadFindUnique).toHaveBeenCalledWith({ where: { id: "lead-1" } });
    });

    it("loads the correct Thread by id", async () => {
      await processInboundMessage({ leadId: "lead-1", threadId: "thread-1" });
      expect(threadFindUnique).toHaveBeenCalledWith({ where: { id: "thread-1" } });
    });

    it("loads campaign context from the Lead's own campaignId", async () => {
      await processInboundMessage({ leadId: "lead-1", threadId: "thread-1" });
      expect(campaignFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "c1" } }),
      );
    });

    it("includes recent messages in chronological order and the current message", async () => {
      await processInboundMessage({ leadId: "lead-1", threadId: "thread-1" });

      const request = converseMock.mock.calls[0][0];
      expect(request.recentMessages.map((m: { content: string }) => m.content)).toEqual([
        "Hello",
        "Hi! How can I help?",
        "Yes, tell me more",
      ]);
      expect(request.currentMessage).toBe("Yes, tell me more");
    });

    it("scopes recent messages strictly to the given thread, never another Lead/campaign/thread", async () => {
      await processInboundMessage({ leadId: "lead-1", threadId: "thread-1" });
      expect(messageFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { threadId: "thread-1" } }),
      );
    });

    it("throws LeadNotFoundError when the Lead does not exist", async () => {
      leadFindUnique.mockResolvedValue(null);
      await expect(
        processInboundMessage({ leadId: "missing", threadId: "thread-1" }),
      ).rejects.toBeInstanceOf(LeadNotFoundError);
    });

    it("throws ThreadNotFoundError when the Thread does not exist", async () => {
      threadFindUnique.mockResolvedValue(null);
      await expect(
        processInboundMessage({ leadId: "lead-1", threadId: "missing" }),
      ).rejects.toBeInstanceOf(ThreadNotFoundError);
    });

    it("throws ThreadLeadMismatchError when the Thread belongs to a different Lead", async () => {
      threadFindUnique.mockResolvedValue({ ...THREAD, leadId: "other-lead" });
      await expect(
        processInboundMessage({ leadId: "lead-1", threadId: "thread-1" }),
      ).rejects.toBeInstanceOf(ThreadLeadMismatchError);
    });

    it("throws NoInboundMessageError when the thread has no inbound message", async () => {
      messageFindMany.mockResolvedValue([RECENT_DESC[1]]); // only the outbound one
      await expect(
        processInboundMessage({ leadId: "lead-1", threadId: "thread-1" }),
      ).rejects.toBeInstanceOf(NoInboundMessageError);
    });
  });

  describe("AI processing", () => {
    it("rejects an AI response that fails schema validation and creates nothing", async () => {
      converseMock.mockResolvedValue({ response: "hi" }); // missing customerInfo

      await expect(
        processInboundMessage({ leadId: "lead-1", threadId: "thread-1" }),
      ).rejects.toBeInstanceOf(ConversationAiError);
      expect(leadUpdate).not.toHaveBeenCalled();
      expect(messageCreate).not.toHaveBeenCalled();
    });

    it("rejects an AI response containing a hot/warm/cold classification field", async () => {
      converseMock.mockResolvedValue({
        response: "hi",
        customerInfo: { name: null, location: null, currentProvider: null, interest: null },
        status: "hot",
      });

      await expect(
        processInboundMessage({ leadId: "lead-1", threadId: "thread-1" }),
      ).rejects.toBeInstanceOf(ConversationAiError);
      expect(leadUpdate).not.toHaveBeenCalled();
    });

    it("propagates a provider failure as ConversationAiError without touching the Lead", async () => {
      converseMock.mockRejectedValue(new Error("provider timeout"));

      await expect(
        processInboundMessage({ leadId: "lead-1", threadId: "thread-1" }),
      ).rejects.toBeInstanceOf(ConversationAiError);
      expect(leadUpdate).not.toHaveBeenCalled();
      expect(messageCreate).not.toHaveBeenCalled();
    });

    it("never modifies Lead.status", async () => {
      await processInboundMessage({ leadId: "lead-1", threadId: "thread-1" });

      expect(leadUpdate).toHaveBeenCalledWith({
        where: { id: "lead-1" },
        data: { customerInfo: expect.any(Object) },
      });
    });
  });

  describe("customer information", () => {
    it("saves newly extracted customer information", async () => {
      await processInboundMessage({ leadId: "lead-1", threadId: "thread-1" });

      expect(leadUpdate).toHaveBeenCalledWith({
        where: { id: "lead-1" },
        data: { customerInfo: expect.objectContaining({ location: "Petaling Jaya" }) },
      });
    });

    it("preserves existing customer information not returned by the AI", async () => {
      await processInboundMessage({ leadId: "lead-1", threadId: "thread-1" });

      expect(leadUpdate).toHaveBeenCalledWith({
        where: { id: "lead-1" },
        data: { customerInfo: expect.objectContaining({ name: "Jane" }) },
      });
    });

    it("does not let null values from the AI erase existing information", async () => {
      leadFindUnique.mockResolvedValue({
        ...LEAD,
        customerInfo: { name: "Jane", currentProvider: "Maxis" },
      });
      converseMock.mockResolvedValue({
        response: "ok",
        customerInfo: { name: null, location: null, currentProvider: null, interest: null },
      });

      await processInboundMessage({ leadId: "lead-1", threadId: "thread-1" });

      expect(leadUpdate).toHaveBeenCalledWith({
        where: { id: "lead-1" },
        data: { customerInfo: { name: "Jane", currentProvider: "Maxis" } },
      });
    });
  });

  describe("outbound message", () => {
    it("persists the outbound AI message with direction 'outbound'", async () => {
      await processInboundMessage({ leadId: "lead-1", threadId: "thread-1" });

      expect(messageCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: "outbound",
          content: VALID_AI_OUTPUT.response,
          threadId: "thread-1",
          leadId: "lead-1",
          externalMessageId: null,
        }),
      });
    });

    it("persists the outbound message before attempting the provider send", async () => {
      await processInboundMessage({ leadId: "lead-1", threadId: "thread-1" });
      expect(callOrder.indexOf("messageCreate")).toBeLessThan(callOrder.indexOf("send"));
    });

    it("does not delete the outbound message when the provider send fails", async () => {
      sendMock.mockResolvedValue({ success: false, failureReason: "network down" });

      const result = await processInboundMessage({ leadId: "lead-1", threadId: "thread-1" });

      expect(result.delivered).toBe(false);
      if (!result.delivered) expect(result.failureReason).toBe("network down");
      expect(messageUpdate).not.toHaveBeenCalled();
    });

    it("does not invent a fake externalMessageId when the provider send fails", async () => {
      sendMock.mockResolvedValue({ success: false, failureReason: "network down" });

      const result = await processInboundMessage({ leadId: "lead-1", threadId: "thread-1" });

      expect(result.outboundMessage.externalMessageId).toBeNull();
    });

    it("records exactly the provider-returned externalMessageId on success, never fabricating one", async () => {
      const result = await processInboundMessage({ leadId: "lead-1", threadId: "thread-1" });

      expect(messageUpdate).toHaveBeenCalledWith({
        where: { id: "outbound-1" },
        data: { externalMessageId: "stub-message-thread-1-123" },
      });
      expect(result.delivered).toBe(true);
      if (result.delivered) expect(result.outboundMessage.externalMessageId).toBe("stub-message-thread-1-123");
    });
  });
});
