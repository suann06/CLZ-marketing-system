import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Prisma is fully mocked — never touches the real Supabase database. The
// mocked client below deliberately exposes only campaign.findUnique and
// sale.findMany — no `lead.findMany`, no write methods, no logActivity
// import at all — if this service ever tried to read Lead directly, write
// anything, or log an activity, the call would fail loudly with "is not a
// function"/"is not defined", a structural guarantee this is a pure,
// read-only extraction over Sale alone.
const { campaignFindUnique, saleFindMany } = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  saleFindMany: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    campaign: { findUnique: campaignFindUnique },
    sale: { findMany: saleFindMany },
  },
}));

import { getCampaignFeedbackData } from "@/server/services/feedback-service";
import { CampaignNotFoundError } from "@/server/services/campaign-service";

describe("getCampaignFeedbackData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    saleFindMany.mockResolvedValue([]);
  });

  describe("campaign", () => {
    it("returns feedback for an existing Campaign", async () => {
      saleFindMany.mockResolvedValue([
        { leadId: "lead-1", status: "won", saleValue: new Prisma.Decimal("399.00"), closedAt: new Date("2026-09-14T10:30:00.000Z") },
      ]);

      const result = await getCampaignFeedbackData("c1");
      expect(result).toHaveLength(1);
    });

    it("throws CampaignNotFoundError for a missing Campaign", async () => {
      campaignFindUnique.mockResolvedValue(null);

      await expect(getCampaignFeedbackData("missing")).rejects.toBeInstanceOf(CampaignNotFoundError);
      expect(saleFindMany).not.toHaveBeenCalled();
    });

    it("returns an empty array for an existing Campaign with no Sales", async () => {
      saleFindMany.mockResolvedValue([]);

      const result = await getCampaignFeedbackData("c1");
      expect(result).toEqual([]);
    });
  });

  describe("outcomes", () => {
    it("produces outcome: 'won' for a won Sale", async () => {
      saleFindMany.mockResolvedValue([
        { leadId: "lead-1", status: "won", saleValue: new Prisma.Decimal("100.00"), closedAt: new Date() },
      ]);

      const [item] = await getCampaignFeedbackData("c1");
      expect(item.outcome).toBe("won");
    });

    it("produces outcome: 'lost' for a lost Sale", async () => {
      saleFindMany.mockResolvedValue([
        { leadId: "lead-2", status: "lost", saleValue: null, closedAt: new Date() },
      ]);

      const [item] = await getCampaignFeedbackData("c1");
      expect(item.outcome).toBe("lost");
    });
  });

  describe("sale value", () => {
    it("returns the won saleValue as a two-decimal string", async () => {
      saleFindMany.mockResolvedValue([
        { leadId: "lead-1", status: "won", saleValue: new Prisma.Decimal("399"), closedAt: new Date() },
      ]);

      const [item] = await getCampaignFeedbackData("c1");
      expect(item.saleValue).toBe("399.00");
    });

    it("returns null saleValue for a lost Sale", async () => {
      saleFindMany.mockResolvedValue([
        { leadId: "lead-2", status: "lost", saleValue: null, closedAt: new Date() },
      ]);

      const [item] = await getCampaignFeedbackData("c1");
      expect(item.saleValue).toBeNull();
    });

    it("never exposes a raw Prisma Decimal object", async () => {
      saleFindMany.mockResolvedValue([
        { leadId: "lead-1", status: "won", saleValue: new Prisma.Decimal("125000"), closedAt: new Date() },
      ]);

      const [item] = await getCampaignFeedbackData("c1");
      expect(typeof item.saleValue).toBe("string");
      expect(item.saleValue).toBe("125000.00");
    });
  });

  describe("timestamp", () => {
    it("returns closedAt correctly", async () => {
      const closedAt = new Date("2026-09-14T11:20:00.000Z");
      saleFindMany.mockResolvedValue([
        { leadId: "lead-1", status: "lost", saleValue: null, closedAt },
      ]);

      const [item] = await getCampaignFeedbackData("c1");
      expect(item.closedAt).toEqual(closedAt);
    });
  });

  describe("no sale", () => {
    it("excludes a Lead without a Sale (never queries Lead at all)", async () => {
      // The service never calls prisma.lead.* — it only ever reads Sale,
      // so a Lead without a Sale row structurally cannot appear.
      saleFindMany.mockResolvedValue([
        { leadId: "lead-a", status: "won", saleValue: new Prisma.Decimal("50.00"), closedAt: new Date() },
      ]);

      const result = await getCampaignFeedbackData("c1");
      expect(result.map((r) => r.leadId)).toEqual(["lead-a"]);
    });
  });

  describe("isolation", () => {
    it("scopes the Sale query to the requested campaignId", async () => {
      await getCampaignFeedbackData("campaign-a");

      expect(saleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { campaignId: "campaign-a" } }),
      );
    });

    it("only returns leadIds from Sales the mocked query scoped to this campaign", async () => {
      saleFindMany.mockImplementation(async ({ where }: { where: { campaignId: string } }) =>
        where.campaignId === "campaign-a"
          ? [{ leadId: "lead-1", status: "won", saleValue: new Prisma.Decimal("10.00"), closedAt: new Date() }]
          : [{ leadId: "lead-from-other-campaign", status: "won", saleValue: new Prisma.Decimal("999.00"), closedAt: new Date() }],
      );

      const result = await getCampaignFeedbackData("campaign-a");
      expect(result.map((r) => r.leadId)).toEqual(["lead-1"]);
    });
  });

  describe("data correctness", () => {
    it("reflects the current Sale status (e.g. after a won -> lost correction)", async () => {
      saleFindMany.mockResolvedValue([
        { leadId: "lead-1", status: "lost", saleValue: null, closedAt: new Date() },
      ]);

      const [item] = await getCampaignFeedbackData("c1");
      expect(item.outcome).toBe("lost");
    });

    it("reflects a corrected saleValue", async () => {
      saleFindMany.mockResolvedValue([
        { leadId: "lead-1", status: "won", saleValue: new Prisma.Decimal("999.99"), closedAt: new Date() },
      ]);

      const [item] = await getCampaignFeedbackData("c1");
      expect(item.saleValue).toBe("999.99");
    });
  });

  describe("read-only behavior", () => {
    it("performs no database writes and no ActivityLog/AI calls (mock surface has none to call)", async () => {
      saleFindMany.mockResolvedValue([
        { leadId: "lead-1", status: "won", saleValue: new Prisma.Decimal("100.00"), closedAt: new Date() },
      ]);

      // If the service tried prisma.sale.create/update, prisma.lead.*, or
      // any logActivity/provider call, it would throw before reaching
      // here (those methods/module exports don't exist on the mocks).
      await expect(getCampaignFeedbackData("c1")).resolves.toBeTruthy();
    });
  });
});
