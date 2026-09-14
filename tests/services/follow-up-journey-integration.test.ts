import { describe, expect, it, vi, beforeEach } from "vitest";

// End-to-end composition of follow-up-service.ts + handover-service.ts
// against one shared in-memory-ish mocked Prisma client — simulating what
// the webhook route wires together, without a real database. No route
// tests exist anywhere in this project (only service-level), so this
// mirrors that convention rather than spinning up a Next.js request.
const {
  leadStore,
  followUpStore,
  threadFindFirst,
  campaignFindUnique,
  messageCreate,
  messageUpdate,
  logActivityMock,
  sendMock,
} = vi.hoisted(() => {
  const leadStore = new Map<string, Record<string, unknown>>();
  const followUpStore = new Map<string, Record<string, unknown>>();
  return {
    leadStore,
    followUpStore,
    threadFindFirst: vi.fn(),
    campaignFindUnique: vi.fn(),
    messageCreate: vi.fn(),
    messageUpdate: vi.fn(),
    logActivityMock: vi.fn(),
    sendMock: vi.fn(),
  };
});

vi.mock("@/server/db/client", () => ({
  prisma: {
    lead: {
      findUnique: vi.fn(async ({ where: { id } }: { where: { id: string } }) => leadStore.get(id) ?? null),
      update: vi.fn(async ({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const current = leadStore.get(id)!;
        const updated = { ...current, ...data };
        leadStore.set(id, updated);
        return updated;
      }),
    },
    followUp: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return [...followUpStore.values()].filter((f) => {
          if (where.leadId && f.leadId !== where.leadId) return false;
          if (typeof where.status === "string" && f.status !== where.status) return false;
          if (where.status && typeof where.status === "object" && "not" in (where.status as object)) {
            const not = (where.status as { not: string }).not;
            if (f.status === not) return false;
          }
          if ("claimedAt" in where && where.claimedAt === null && f.claimedAt !== null) return false;
          if (
            where.scheduledAt &&
            typeof where.scheduledAt === "object" &&
            "lte" in (where.scheduledAt as object)
          ) {
            const lte = (where.scheduledAt as { lte: Date }).lte;
            if ((f.scheduledAt as Date).getTime() > lte.getTime()) return false;
          }
          return true;
        });
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `followup-${followUpStore.size + 1}`,
          status: "pending",
          claimedAt: null,
          sentAt: null,
          failureReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        followUpStore.set(row.id as string, row);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const targets = [...followUpStore.values()].filter((f) => {
          if (where.id && typeof where.id === "object" && "in" in (where.id as object)) {
            if (!(where.id as { in: string[] }).in.includes(f.id as string)) return false;
          } else if (where.id && f.id !== where.id) {
            return false;
          }
          if (where.status && f.status !== where.status) return false;
          if (where.claimedAt === null && f.claimedAt !== null) return false;
          return true;
        });
        for (const t of targets) followUpStore.set(t.id as string, { ...t, ...data });
        return { count: targets.length };
      }),
      update: vi.fn(async ({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const updated = { ...followUpStore.get(id)!, ...data };
        followUpStore.set(id, updated);
        return updated;
      }),
    },
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

import { scheduleFollowUpJourney, cancelPendingFollowUps, processDueFollowUps } from "@/server/services/follow-up-service";
import { handoverLead, LeadNotHotError } from "@/server/services/handover-service";

const HUMAN_ACTOR = { type: "human" as const, id: "agent-1" };

describe("warm -> follow-up -> hot -> cancel -> handover journey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leadStore.clear();
    followUpStore.clear();
    leadStore.set("lead-1", { id: "lead-1", campaignId: "c1", name: "Jane", status: "warm", handoverAt: null, agentId: null });
    threadFindFirst.mockResolvedValue({ id: "thread-1", leadId: "lead-1", externalThreadId: "ext-thread-1" });
    campaignFindUnique.mockResolvedValue({ productPromotion: "Unlimited Fibre Plan" });
    messageCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "outbound-1",
      createdAt: new Date(),
      ...data,
    }));
    sendMock.mockResolvedValue({ success: true, externalMessageId: "stub-message-999" });
  });

  it("schedules, processes, cancels on hot, and unlocks handover", async () => {
    // 1. Lead enters the warm follow-up journey.
    const created = await scheduleFollowUpJourney("lead-1");
    expect(created).toHaveLength(3);

    // Handover is not yet available — Lead is still warm.
    await expect(handoverLead("lead-1", HUMAN_ACTOR)).rejects.toBeInstanceOf(LeadNotHotError);

    // 2. Day 1 follow-up becomes due and is sent.
    const day1 = created.find((f) => f.day === 1)!;
    const dueDate = new Date((day1.scheduledAt as Date).getTime() + 1000);
    const [day1Result] = await processDueFollowUps(dueDate);
    expect(day1Result.outcome).toBe("sent");

    // 3. Customer replies and classification (Phase 3D, simulated here by
    // directly flipping status — 3D itself is not re-tested here) moves
    // the Lead to hot.
    leadStore.set("lead-1", { ...leadStore.get("lead-1")!, status: "hot" });

    // 4. Remaining Day 3 / Day 7 follow-ups are cancelled.
    const cancelled = await cancelPendingFollowUps("lead-1", "Lead became hot.");
    expect(cancelled).toHaveLength(2);
    expect(cancelled.every((f) => f.status === "cancelled")).toBe(true);

    // A later processDueFollowUps() run must not send the now-cancelled
    // follow-ups even once their scheduledAt has passed.
    const day7 = created.find((f) => f.day === 7)!;
    const farFuture = new Date((day7.scheduledAt as Date).getTime() + 1000);
    const laterResults = await processDueFollowUps(farFuture);
    expect(laterResults).toHaveLength(0);
    expect(sendMock).toHaveBeenCalledTimes(1); // only the Day 1 send from step 2

    // 5. Handover is now available.
    const handedOver = await handoverLead("lead-1", HUMAN_ACTOR);
    expect(handedOver.agentId).toBe("agent-1");
    expect(handedOver.handoverAt).toBeInstanceOf(Date);
  });
});
