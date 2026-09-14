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

import { updateApplicationStatus, isQualifiedLead } from "@/server/services/application-service";
import { applicationStatusInputSchema } from "@/server/validation/application-status-schema";
import { LeadNotFoundError } from "@/server/services/conversation-service";

const HUMAN_ACTOR = { type: "human" as const, id: "user-1" };

function lead(status: string, applicationStatus: string) {
  return { id: "lead-1", status, applicationStatus };
}

describe("applicationStatusInputSchema", () => {
  it("accepts a valid status", () => {
    expect(applicationStatusInputSchema.safeParse({ applicationStatus: "in_progress" }).success).toBe(true);
  });

  it("rejects an invalid status such as 'qualified'", () => {
    expect(applicationStatusInputSchema.safeParse({ applicationStatus: "qualified" }).success).toBe(false);
  });

  it("rejects a missing applicationStatus", () => {
    expect(applicationStatusInputSchema.safeParse({}).success).toBe(false);
  });
});

describe("updateApplicationStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leadUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...lead("hot", "not_started"),
      ...data,
    }));
  });

  it("applies a valid application status update", async () => {
    leadFindUnique.mockResolvedValue(lead("hot", "not_started"));

    const result = await updateApplicationStatus("lead-1", "in_progress", HUMAN_ACTOR);

    expect(result.applicationStatus).toBe("in_progress");
    expect(leadUpdate).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: { applicationStatus: "in_progress" },
    });
  });

  it("logs a human-attributed activity entry", async () => {
    leadFindUnique.mockResolvedValue(lead("hot", "not_started"));

    await updateApplicationStatus("lead-1", "submitted", HUMAN_ACTOR);

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "lead",
        action: "application_status_changed",
        actor: HUMAN_ACTOR,
        metadata: { from: "not_started", to: "submitted" },
      }),
    );
  });

  it("throws LeadNotFoundError for a nonexistent Lead", async () => {
    leadFindUnique.mockResolvedValue(null);
    await expect(
      updateApplicationStatus("missing", "in_progress", HUMAN_ACTOR),
    ).rejects.toBeInstanceOf(LeadNotFoundError);
    expect(leadUpdate).not.toHaveBeenCalled();
  });
});

describe("isQualifiedLead", () => {
  it("identifies a qualified Lead: hot + submitted", () => {
    expect(isQualifiedLead({ status: "hot", applicationStatus: "submitted" } as never)).toBe(true);
  });

  it("is not qualified when hot but not submitted", () => {
    expect(isQualifiedLead({ status: "hot", applicationStatus: "in_progress" } as never)).toBe(false);
  });

  it("is not qualified when submitted but not hot", () => {
    expect(isQualifiedLead({ status: "warm", applicationStatus: "submitted" } as never)).toBe(false);
  });
});
