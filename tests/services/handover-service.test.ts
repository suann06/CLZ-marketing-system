import { describe, expect, it, vi, beforeEach } from "vitest";

const { leadFindUnique, leadUpdate, logActivityMock } = vi.hoisted(() => ({
  leadFindUnique: vi.fn(),
  leadUpdate: vi.fn(),
  logActivityMock: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    lead: { findUnique: leadFindUnique, update: leadUpdate },
  },
}));

vi.mock("@/lib/actor", () => ({
  logActivity: logActivityMock,
}));

import { handoverLead, LeadNotHotError } from "@/server/services/handover-service";
import { LeadNotFoundError } from "@/server/services/conversation-service";

const HUMAN_ACTOR = { type: "human" as const, id: "user-1" };

function lead(status: string) {
  return { id: "lead-1", status, handoverAt: null, agentId: null };
}

describe("handoverLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leadUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...lead("hot"),
      ...data,
    }));
  });

  it("allows handover of a hot Lead", async () => {
    leadFindUnique.mockResolvedValue(lead("hot"));

    const result = await handoverLead("lead-1", HUMAN_ACTOR);

    expect(result.agentId).toBe("user-1");
    expect(leadUpdate).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: { handoverAt: expect.any(Date), agentId: "user-1" },
    });
  });

  it("rejects handover of a warm Lead", async () => {
    leadFindUnique.mockResolvedValue(lead("warm"));
    await expect(handoverLead("lead-1", HUMAN_ACTOR)).rejects.toBeInstanceOf(LeadNotHotError);
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it("rejects handover of a cold Lead", async () => {
    leadFindUnique.mockResolvedValue(lead("cold"));
    await expect(handoverLead("lead-1", HUMAN_ACTOR)).rejects.toBeInstanceOf(LeadNotHotError);
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it("rejects handover of a new Lead", async () => {
    leadFindUnique.mockResolvedValue(lead("new"));
    await expect(handoverLead("lead-1", HUMAN_ACTOR)).rejects.toBeInstanceOf(LeadNotHotError);
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it("stores the given agentId when supplied", async () => {
    leadFindUnique.mockResolvedValue(lead("hot"));

    await handoverLead("lead-1", HUMAN_ACTOR, "agent-42");

    expect(leadUpdate).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: { handoverAt: expect.any(Date), agentId: "agent-42" },
    });
  });

  it("defaults agentId to the acting human actor's id when not supplied", async () => {
    leadFindUnique.mockResolvedValue(lead("hot"));

    await handoverLead("lead-1", HUMAN_ACTOR);

    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ agentId: "user-1" }) }),
    );
  });

  it("stores handoverAt", async () => {
    leadFindUnique.mockResolvedValue(lead("hot"));

    await handoverLead("lead-1", HUMAN_ACTOR);

    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ handoverAt: expect.any(Date) }) }),
    );
  });

  it("logs a human-attributed activity entry", async () => {
    leadFindUnique.mockResolvedValue(lead("hot"));

    await handoverLead("lead-1", HUMAN_ACTOR);

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "lead",
        action: "lead_handed_over",
        actor: HUMAN_ACTOR,
      }),
    );
  });

  it("throws LeadNotFoundError for a nonexistent Lead", async () => {
    leadFindUnique.mockResolvedValue(null);
    await expect(handoverLead("missing", HUMAN_ACTOR)).rejects.toBeInstanceOf(LeadNotFoundError);
  });
});
