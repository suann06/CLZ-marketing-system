import { describe, expect, it, vi, beforeEach } from "vitest";

// Prisma and the WhatsApp provider are fully mocked — never touches the
// real Supabase database or calls any real WhatsApp service. The mocked
// prisma client below deliberately exposes only the exact methods
// follow-up-service.ts is documented to use.
const {
  followUpFindMany,
  followUpCreate,
  followUpUpdateMany,
  followUpUpdate,
  leadFindUnique,
  threadFindFirst,
  campaignFindUnique,
  messageCreate,
  messageUpdate,
  logActivityMock,
  sendMock,
} = vi.hoisted(() => ({
  followUpFindMany: vi.fn(),
  followUpCreate: vi.fn(),
  followUpUpdateMany: vi.fn(),
  followUpUpdate: vi.fn(),
  leadFindUnique: vi.fn(),
  threadFindFirst: vi.fn(),
  campaignFindUnique: vi.fn(),
  messageCreate: vi.fn(),
  messageUpdate: vi.fn(),
  logActivityMock: vi.fn(),
  sendMock: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    followUp: {
      findMany: followUpFindMany,
      create: followUpCreate,
      updateMany: followUpUpdateMany,
      update: followUpUpdate,
    },
    lead: { findUnique: leadFindUnique },
    whatsAppThread: { findFirst: threadFindFirst },
    campaign: { findUnique: campaignFindUnique },
    whatsAppMessage: { create: messageCreate, update: messageUpdate },
  },
}));

vi.mock("@/lib/actor", () => ({
  logActivity: logActivityMock,
}));

vi.mock("@/server/providers/whatsapp/provider-registry", () => ({
  getWhatsAppProvider: () => ({ providerName: "mock-whatsapp", send: sendMock }),
}));

import {
  scheduleFollowUpJourney,
  cancelPendingFollowUps,
  processDueFollowUps,
  FOLLOW_UP_DAYS,
} from "@/server/services/follow-up-service";
import { LeadNotFoundError } from "@/server/services/conversation-service";

const LEAD = { id: "lead-1", campaignId: "c1", name: "Jane", status: "warm" };
const THREAD = { id: "thread-1", leadId: "lead-1", provider: "stub", externalThreadId: "ext-thread-1" };
const CAMPAIGN = { productPromotion: "Unlimited Fibre Plan" };

describe("scheduleFollowUpJourney", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leadFindUnique.mockResolvedValue({ id: "lead-1" });
    followUpCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: `followup-${data.day}`,
      status: "pending",
      claimedAt: null,
      sentAt: null,
      failureReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));
  });

  it("creates Day 1, Day 3, and Day 7 follow-ups", async () => {
    followUpFindMany.mockResolvedValue([]);

    const created = await scheduleFollowUpJourney("lead-1");

    expect(created).toHaveLength(3);
    expect(created.map((f) => f.day).sort()).toEqual([...FOLLOW_UP_DAYS].sort());
  });

  it("schedules each day at the correct offset from entry time", async () => {
    followUpFindMany.mockResolvedValue([]);
    const before = Date.now();

    await scheduleFollowUpJourney("lead-1");

    const calls = followUpCreate.mock.calls as [{ data: { day: number; scheduledAt: Date } }][];
    for (const [{ data }] of calls) {
      const expectedOffsetMs = data.day * 24 * 60 * 60 * 1000;
      const actualOffsetMs = data.scheduledAt.getTime() - before;
      expect(Math.abs(actualOffsetMs - expectedOffsetMs)).toBeLessThan(5000);
    }
  });

  it("does not create duplicate follow-ups when a journey is already active", async () => {
    const existing = [{ id: "existing-1", status: "pending" }];
    followUpFindMany.mockResolvedValue(existing);

    const result = await scheduleFollowUpJourney("lead-1");

    expect(result).toBe(existing);
    expect(followUpCreate).not.toHaveBeenCalled();
  });

  it("throws LeadNotFoundError for a nonexistent lead", async () => {
    leadFindUnique.mockResolvedValue(null);
    await expect(scheduleFollowUpJourney("missing")).rejects.toBeInstanceOf(LeadNotFoundError);
  });
});

describe("cancelPendingFollowUps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels pending, unclaimed follow-ups and logs once", async () => {
    followUpFindMany.mockResolvedValue([
      { id: "f1", status: "pending", claimedAt: null },
      { id: "f2", status: "pending", claimedAt: null },
    ]);

    const result = await cancelPendingFollowUps("lead-1", "Lead became hot.");

    expect(followUpUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["f1", "f2"] } },
      data: { status: "cancelled" },
    });
    expect(result).toHaveLength(2);
    expect(logActivityMock).toHaveBeenCalledTimes(1);
  });

  it("does nothing when there are no cancellable follow-ups", async () => {
    followUpFindMany.mockResolvedValue([]);

    const result = await cancelPendingFollowUps("lead-1", "Lead became hot.");

    expect(result).toEqual([]);
    expect(followUpUpdateMany).not.toHaveBeenCalled();
    expect(logActivityMock).not.toHaveBeenCalled();
  });
});

function dueFollowUp(overrides: Record<string, unknown> = {}) {
  return {
    id: "followup-1",
    leadId: "lead-1",
    day: 1,
    scheduledAt: new Date("2024-01-01"),
    status: "pending",
    claimedAt: null,
    sentAt: null,
    failureReason: null,
    ...overrides,
  };
}

describe("processDueFollowUps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leadFindUnique.mockResolvedValue(LEAD);
    threadFindFirst.mockResolvedValue(THREAD);
    campaignFindUnique.mockResolvedValue(CAMPAIGN);
    followUpUpdateMany.mockResolvedValue({ count: 1 });
    followUpUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...dueFollowUp(),
      ...data,
    }));
    messageCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "outbound-1",
      createdAt: new Date(),
      ...data,
    }));
    messageUpdate.mockResolvedValue({ id: "outbound-1" });
    sendMock.mockResolvedValue({ success: true, externalMessageId: "stub-message-thread-1-123" });
  });

  it("sends a follow-up message for a warm Lead", async () => {
    followUpFindMany.mockResolvedValue([dueFollowUp()]);
    leadFindUnique.mockResolvedValue({ ...LEAD, status: "warm" });

    const [result] = await processDueFollowUps(new Date("2024-01-02"));

    expect(result.outcome).toBe("sent");
    expect(sendMock).toHaveBeenCalledWith({ externalThreadId: "ext-thread-1", content: expect.any(String) });
  });

  it("sends a follow-up message for a cold Lead", async () => {
    followUpFindMany.mockResolvedValue([dueFollowUp()]);
    leadFindUnique.mockResolvedValue({ ...LEAD, status: "cold" });

    const [result] = await processDueFollowUps(new Date("2024-01-02"));

    expect(result.outcome).toBe("sent");
  });

  it("cancels (does not send) a follow-up for a hot Lead", async () => {
    followUpFindMany.mockResolvedValue([dueFollowUp()]);
    leadFindUnique.mockResolvedValue({ ...LEAD, status: "hot" });

    const [result] = await processDueFollowUps(new Date("2024-01-02"));

    expect(result.outcome).toBe("cancelled");
    expect(sendMock).not.toHaveBeenCalled();
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it("does not attempt to claim/process a follow-up that is not due or not pending (query scoping)", async () => {
    followUpFindMany.mockResolvedValue([]);

    const results = await processDueFollowUps(new Date("2024-01-02"));

    expect(followUpFindMany).toHaveBeenCalledWith({
      where: { status: "pending", claimedAt: null, scheduledAt: { lte: new Date("2024-01-02") } },
    });
    expect(results).toEqual([]);
  });

  it("skips a follow-up it fails to claim (already claimed/resolved by another call)", async () => {
    followUpFindMany.mockResolvedValue([dueFollowUp()]);
    followUpUpdateMany.mockResolvedValue({ count: 0 });

    const [result] = await processDueFollowUps(new Date("2024-01-02"));

    expect(result.outcome).toBe("skipped");
    expect(leadFindUnique).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("claims via an atomic conditional update scoped to pending + unclaimed", async () => {
    followUpFindMany.mockResolvedValue([dueFollowUp()]);

    await processDueFollowUps(new Date("2024-01-02"));

    expect(followUpUpdateMany).toHaveBeenCalledWith({
      where: { id: "followup-1", status: "pending", claimedAt: null },
      data: { claimedAt: new Date("2024-01-02") },
    });
  });

  it("never marks a follow-up sent before the provider call succeeds", async () => {
    followUpFindMany.mockResolvedValue([dueFollowUp()]);
    const callOrder: string[] = [];
    sendMock.mockImplementation(async () => {
      callOrder.push("send");
      return { success: true, externalMessageId: "stub-message-thread-1-999" };
    });
    followUpUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      if (data.status === "sent") callOrder.push("mark-sent");
      return { ...dueFollowUp(), ...data };
    });

    await processDueFollowUps(new Date("2024-01-02"));

    expect(callOrder).toEqual(["send", "mark-sent"]);
    // The claim step (updateMany) never sets status at all — only
    // claimedAt — so "sent" is written exactly once, by followUpUpdate,
    // strictly after the provider call resolved successfully.
    expect(followUpUpdateMany).toHaveBeenCalledWith({
      where: { id: "followup-1", status: "pending", claimedAt: null },
      data: { claimedAt: expect.any(Date) },
    });
    expect(followUpUpdate).toHaveBeenCalledWith({
      where: { id: "followup-1" },
      data: { status: "sent", sentAt: expect.any(Date) },
    });
  });

  it("on provider failure, sets status to failed and preserves the failure reason", async () => {
    followUpFindMany.mockResolvedValue([dueFollowUp()]);
    sendMock.mockResolvedValue({ success: false, failureReason: "network down" });

    const [result] = await processDueFollowUps(new Date("2024-01-02"));

    expect(result.outcome).toBe("failed");
    expect(followUpUpdate).toHaveBeenCalledWith({
      where: { id: "followup-1" },
      data: { status: "failed", failureReason: "network down" },
    });
    expect(messageUpdate).not.toHaveBeenCalled();
  });

  it("never invents a fake externalMessageId on success", async () => {
    followUpFindMany.mockResolvedValue([dueFollowUp()]);
    sendMock.mockResolvedValue({ success: true, externalMessageId: "stub-message-thread-1-123" });

    await processDueFollowUps(new Date("2024-01-02"));

    expect(messageUpdate).toHaveBeenCalledWith({
      where: { id: "outbound-1" },
      data: { externalMessageId: "stub-message-thread-1-123" },
    });
  });

  it("Scenario A: a follow-up already sent is not found by the due query again (not re-sent)", async () => {
    // Once sent, a real DB query for status: "pending" would no longer
    // return this row — simulated here by an empty due list on the
    // second call.
    followUpFindMany.mockResolvedValueOnce([dueFollowUp()]).mockResolvedValueOnce([]);

    await processDueFollowUps(new Date("2024-01-02"));
    await processDueFollowUps(new Date("2024-01-02"));

    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("Scenario B: a second concurrent claim attempt on the same row loses the race and never sends", async () => {
    // Same due row handed to two overlapping processDueFollowUps() calls
    // (simulating two near-simultaneous invocations before either has
    // written back) — only the first claim succeeds (count: 1); the
    // second's conditional UPDATE matches 0 rows.
    followUpFindMany.mockResolvedValue([dueFollowUp()]);
    followUpUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const [firstResult] = await processDueFollowUps(new Date("2024-01-02"));
    const [secondResult] = await processDueFollowUps(new Date("2024-01-02"));

    expect(firstResult.outcome).toBe("sent");
    expect(secondResult.outcome).toBe("skipped");
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("uses actorType 'system' for follow-up activity logging", async () => {
    followUpFindMany.mockResolvedValue([dueFollowUp()]);

    await processDueFollowUps(new Date("2024-01-02"));

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ actor: { type: "system", id: null } }),
    );
  });
});
