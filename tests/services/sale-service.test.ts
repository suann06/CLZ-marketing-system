import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Prisma is fully mocked — never touches the real Supabase database. The
// mocked client below deliberately exposes only lead.findUnique,
// sale.findUnique/create/update, and logActivity — no `lead.update`, no
// `sale.delete` — if this service ever tried to mutate the Lead itself or
// delete a Sale, the call would fail loudly with "is not a function", a
// structural guarantee this service only ever creates/corrects Sale rows.
const { leadFindUnique, saleFindUnique, saleCreate, saleUpdate, logActivityMock } = vi.hoisted(() => ({
  leadFindUnique: vi.fn(),
  saleFindUnique: vi.fn(),
  saleCreate: vi.fn(),
  saleUpdate: vi.fn(),
  logActivityMock: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    lead: { findUnique: leadFindUnique },
    sale: { findUnique: saleFindUnique, create: saleCreate, update: saleUpdate },
  },
}));

vi.mock("@/lib/actor", () => ({
  logActivity: logActivityMock,
}));

import {
  recordSaleOutcome,
  updateSaleOutcome,
  ApplicationNotSubmittedError,
  SaleAlreadyRecordedError,
  SaleNotFoundError,
} from "@/server/services/sale-service";
import { LeadNotFoundError } from "@/server/services/conversation-service";
import { saleOutcomeInputSchema } from "@/server/validation/sale-schema";

const HUMAN_ACTOR = { type: "human" as const, id: "agent-1" };

function lead(applicationStatus: string, overrides: Record<string, unknown> = {}) {
  return { id: "lead-1", campaignId: "c1", applicationStatus, ...overrides };
}

function existingSale(overrides: Record<string, unknown> = {}) {
  return {
    id: "sale-1",
    leadId: "lead-1",
    campaignId: "c1",
    status: "won",
    saleValue: new Prisma.Decimal(100),
    lostReason: null,
    closedAt: new Date("2024-01-01T00:00:00Z"),
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("saleOutcomeInputSchema", () => {
  it("accepts a valid won payload", () => {
    expect(saleOutcomeInputSchema.safeParse({ status: "won", saleValue: 100 }).success).toBe(true);
  });

  it("accepts a valid lost payload", () => {
    expect(
      saleOutcomeInputSchema.safeParse({ status: "lost", lostReason: "Too expensive" }).success,
    ).toBe(true);
  });

  it("rejects won with a missing saleValue", () => {
    expect(saleOutcomeInputSchema.safeParse({ status: "won" }).success).toBe(false);
  });

  it("rejects won with a non-positive saleValue", () => {
    expect(saleOutcomeInputSchema.safeParse({ status: "won", saleValue: 0 }).success).toBe(false);
    expect(saleOutcomeInputSchema.safeParse({ status: "won", saleValue: -5 }).success).toBe(false);
  });

  it("rejects lost with a missing lostReason", () => {
    expect(saleOutcomeInputSchema.safeParse({ status: "lost" }).success).toBe(false);
  });

  it("rejects lost with an empty lostReason", () => {
    expect(saleOutcomeInputSchema.safeParse({ status: "lost", lostReason: "" }).success).toBe(false);
  });

  it("rejects won with a lostReason present (wrong cross-field)", () => {
    expect(
      saleOutcomeInputSchema.safeParse({ status: "won", saleValue: 100, lostReason: "x" }).success,
    ).toBe(false);
  });

  it("rejects lost with a saleValue present (wrong cross-field)", () => {
    expect(
      saleOutcomeInputSchema.safeParse({ status: "lost", lostReason: "x", saleValue: 100 }).success,
    ).toBe(false);
  });

  it("rejects an invalid status value", () => {
    expect(saleOutcomeInputSchema.safeParse({ status: "open", saleValue: 100 }).success).toBe(false);
    expect(saleOutcomeInputSchema.safeParse({ status: "pending" }).success).toBe(false);
  });

  it("rejects a client-supplied leadId, campaignId, or closedAt (forbidden fields)", () => {
    expect(
      saleOutcomeInputSchema.safeParse({
        status: "won",
        saleValue: 100,
        leadId: "lead-1",
      }).success,
    ).toBe(false);
    expect(
      saleOutcomeInputSchema.safeParse({
        status: "won",
        saleValue: 100,
        campaignId: "c1",
      }).success,
    ).toBe(false);
    expect(
      saleOutcomeInputSchema.safeParse({
        status: "won",
        saleValue: 100,
        closedAt: "2024-01-01T00:00:00Z",
      }).success,
    ).toBe(false);
  });
});

describe("recordSaleOutcome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saleCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "sale-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));
  });

  it("creates a won Sale", async () => {
    leadFindUnique.mockResolvedValue(lead("submitted"));
    saleFindUnique.mockResolvedValue(null);

    const sale = await recordSaleOutcome("lead-1", { status: "won", saleValue: 500 }, HUMAN_ACTOR);

    expect(sale.status).toBe("won");
    expect(saleCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: "lead-1",
        campaignId: "c1",
        status: "won",
        lostReason: null,
      }),
    });
    const createdData = saleCreate.mock.calls[0][0].data;
    expect(createdData.saleValue).toBeInstanceOf(Prisma.Decimal);
    expect(createdData.saleValue.toNumber()).toBe(500);
  });

  it("creates a lost Sale", async () => {
    leadFindUnique.mockResolvedValue(lead("submitted"));
    saleFindUnique.mockResolvedValue(null);

    const sale = await recordSaleOutcome(
      "lead-1",
      { status: "lost", lostReason: "Chose a competitor" },
      HUMAN_ACTOR,
    );

    expect(sale.status).toBe("lost");
    expect(saleCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: "lead-1",
        campaignId: "c1",
        status: "lost",
        saleValue: null,
        lostReason: "Chose a competitor",
      }),
    });
  });

  it("allows recording when applicationStatus is submitted", async () => {
    leadFindUnique.mockResolvedValue(lead("submitted"));
    saleFindUnique.mockResolvedValue(null);

    await expect(
      recordSaleOutcome("lead-1", { status: "won", saleValue: 100 }, HUMAN_ACTOR),
    ).resolves.toBeTruthy();
  });

  it("throws LeadNotFoundError for a nonexistent Lead", async () => {
    leadFindUnique.mockResolvedValue(null);

    await expect(
      recordSaleOutcome("missing", { status: "won", saleValue: 100 }, HUMAN_ACTOR),
    ).rejects.toBeInstanceOf(LeadNotFoundError);
    expect(saleCreate).not.toHaveBeenCalled();
  });

  it.each(["not_started", "in_progress"])(
    "rejects when applicationStatus is %s",
    async (applicationStatus) => {
      leadFindUnique.mockResolvedValue(lead(applicationStatus));

      await expect(
        recordSaleOutcome("lead-1", { status: "won", saleValue: 100 }, HUMAN_ACTOR),
      ).rejects.toBeInstanceOf(ApplicationNotSubmittedError);
      expect(saleCreate).not.toHaveBeenCalled();
    },
  );

  it("rejects a duplicate Sale for the same Lead", async () => {
    leadFindUnique.mockResolvedValue(lead("submitted"));
    saleFindUnique.mockResolvedValue(existingSale());

    await expect(
      recordSaleOutcome("lead-1", { status: "won", saleValue: 100 }, HUMAN_ACTOR),
    ).rejects.toBeInstanceOf(SaleAlreadyRecordedError);
    expect(saleCreate).not.toHaveBeenCalled();
  });

  it("derives campaignId from the Lead, never from caller input", async () => {
    leadFindUnique.mockResolvedValue(lead("submitted", { campaignId: "campaign-from-lead" }));
    saleFindUnique.mockResolvedValue(null);

    await recordSaleOutcome("lead-1", { status: "won", saleValue: 100 }, HUMAN_ACTOR);

    expect(saleCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ campaignId: "campaign-from-lead" }) }),
    );
  });

  it("generates closedAt server-side at creation time", async () => {
    leadFindUnique.mockResolvedValue(lead("submitted"));
    saleFindUnique.mockResolvedValue(null);
    const before = Date.now();

    await recordSaleOutcome("lead-1", { status: "won", saleValue: 100 }, HUMAN_ACTOR);

    const createdData = saleCreate.mock.calls[0][0].data;
    expect(createdData.closedAt).toBeInstanceOf(Date);
    expect(createdData.closedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("records the human actor on the ActivityLog entry", async () => {
    leadFindUnique.mockResolvedValue(lead("submitted"));
    saleFindUnique.mockResolvedValue(null);

    await recordSaleOutcome("lead-1", { status: "won", saleValue: 100 }, HUMAN_ACTOR);

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "sale",
        action: "sale_recorded",
        actor: HUMAN_ACTOR,
      }),
    );
  });

  it("logs concise creation metadata without dumping the full row", async () => {
    leadFindUnique.mockResolvedValue(lead("submitted"));
    saleFindUnique.mockResolvedValue(null);

    await recordSaleOutcome("lead-1", { status: "won", saleValue: 100 }, HUMAN_ACTOR);

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { leadId: "lead-1", campaignId: "c1", status: "won", saleValue: 100 },
      }),
    );
  });
});

describe("updateSaleOutcome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saleUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...existingSale(),
      ...data,
      updatedAt: new Date(),
    }));
  });

  it("updates a won Sale to lost", async () => {
    leadFindUnique.mockResolvedValue(lead("submitted"));
    saleFindUnique.mockResolvedValue(existingSale({ status: "won", saleValue: new Prisma.Decimal(100) }));

    const sale = await updateSaleOutcome(
      "lead-1",
      { status: "lost", lostReason: "Budget cut" },
      HUMAN_ACTOR,
    );

    expect(sale.status).toBe("lost");
    expect(saleUpdate).toHaveBeenCalledWith({
      where: { leadId: "lead-1" },
      data: { status: "lost", saleValue: null, lostReason: "Budget cut" },
    });
  });

  it("updates a lost Sale to won", async () => {
    leadFindUnique.mockResolvedValue(lead("submitted"));
    saleFindUnique.mockResolvedValue(existingSale({ status: "lost", saleValue: null, lostReason: "x" }));

    const sale = await updateSaleOutcome("lead-1", { status: "won", saleValue: 250 }, HUMAN_ACTOR);

    expect(sale.status).toBe("won");
    const updateData = saleUpdate.mock.calls[0][0].data;
    expect(updateData.saleValue.toNumber()).toBe(250);
    expect(updateData.lostReason).toBeNull();
  });

  it("updates the saleValue/reason while keeping the same status", async () => {
    leadFindUnique.mockResolvedValue(lead("submitted"));
    saleFindUnique.mockResolvedValue(existingSale({ status: "won", saleValue: new Prisma.Decimal(100) }));

    await updateSaleOutcome("lead-1", { status: "won", saleValue: 999 }, HUMAN_ACTOR);

    const updateData = saleUpdate.mock.calls[0][0].data;
    expect(updateData.saleValue.toNumber()).toBe(999);
  });

  it("throws LeadNotFoundError for a nonexistent Lead", async () => {
    leadFindUnique.mockResolvedValue(null);

    await expect(
      updateSaleOutcome("missing", { status: "won", saleValue: 100 }, HUMAN_ACTOR),
    ).rejects.toBeInstanceOf(LeadNotFoundError);
    expect(saleUpdate).not.toHaveBeenCalled();
  });

  it("throws SaleNotFoundError when no Sale exists yet for the Lead", async () => {
    leadFindUnique.mockResolvedValue(lead("submitted"));
    saleFindUnique.mockResolvedValue(null);

    await expect(
      updateSaleOutcome("lead-1", { status: "won", saleValue: 100 }, HUMAN_ACTOR),
    ).rejects.toBeInstanceOf(SaleNotFoundError);
    expect(saleUpdate).not.toHaveBeenCalled();
  });

  it("rejects when applicationStatus is not submitted", async () => {
    leadFindUnique.mockResolvedValue(lead("in_progress"));
    saleFindUnique.mockResolvedValue(existingSale());

    await expect(
      updateSaleOutcome("lead-1", { status: "won", saleValue: 100 }, HUMAN_ACTOR),
    ).rejects.toBeInstanceOf(ApplicationNotSubmittedError);
    expect(saleUpdate).not.toHaveBeenCalled();
  });

  it("does not include closedAt in the update payload (preserves the original)", async () => {
    leadFindUnique.mockResolvedValue(lead("submitted"));
    saleFindUnique.mockResolvedValue(existingSale());

    await updateSaleOutcome("lead-1", { status: "won", saleValue: 100 }, HUMAN_ACTOR);

    const updateData = saleUpdate.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty("closedAt");
  });

  it("logs sale_updated with before/after metadata and the human actor", async () => {
    leadFindUnique.mockResolvedValue(lead("submitted"));
    saleFindUnique.mockResolvedValue(
      existingSale({ status: "won", saleValue: new Prisma.Decimal(100), lostReason: null }),
    );

    await updateSaleOutcome("lead-1", { status: "lost", lostReason: "Budget cut" }, HUMAN_ACTOR);

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "sale",
        action: "sale_updated",
        actor: HUMAN_ACTOR,
        metadata: expect.objectContaining({
          leadId: "lead-1",
          campaignId: "c1",
          before: expect.objectContaining({ status: "won", lostReason: null }),
          after: expect.objectContaining({ status: "lost", lostReason: "Budget cut" }),
        }),
      }),
    );
  });
});
