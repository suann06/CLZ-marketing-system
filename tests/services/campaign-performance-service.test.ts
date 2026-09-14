import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Prisma is fully mocked — never touches the real Supabase database. The
// mocked client below deliberately exposes only campaign.findUnique,
// lead.count, sale.count, and sale.aggregate — no `lead.findMany`, no
// `sale.findMany`, no write methods at all — if this service ever tried
// to fetch full rows or mutate anything, the call would fail loudly with
// "is not a function", a structural guarantee this is a pure, read-only,
// DB-side-aggregated calculation.
const { campaignFindUnique, leadCount, saleCount, saleAggregate } = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  leadCount: vi.fn(),
  saleCount: vi.fn(),
  saleAggregate: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    campaign: { findUnique: campaignFindUnique },
    lead: { count: leadCount },
    sale: { count: saleCount, aggregate: saleAggregate },
  },
}));

import { getCampaignPerformance } from "@/server/services/campaign-performance-service";
import { CampaignNotFoundError } from "@/server/services/campaign-service";

describe("getCampaignPerformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    leadCount.mockResolvedValue(0);
    saleCount.mockResolvedValue(0);
    saleAggregate.mockResolvedValue({ _sum: { saleValue: null } });
  });

  describe("campaign", () => {
    it("returns performance for an existing Campaign", async () => {
      const result = await getCampaignPerformance("c1");
      expect(result.campaignId).toBe("c1");
    });

    it("throws CampaignNotFoundError for a missing Campaign", async () => {
      campaignFindUnique.mockResolvedValue(null);
      await expect(getCampaignPerformance("missing")).rejects.toBeInstanceOf(CampaignNotFoundError);
      expect(leadCount).not.toHaveBeenCalled();
    });
  });

  describe("leads", () => {
    it("reports the total lead count", async () => {
      leadCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        "applicationStatus" in where ? 3 : 10,
      );

      const result = await getCampaignPerformance("c1");
      expect(result.totalLeads).toBe(10);
      expect(leadCount).toHaveBeenCalledWith({ where: { campaignId: "c1" } });
    });

    it("reports the submitted-application count", async () => {
      leadCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        "applicationStatus" in where ? 3 : 10,
      );

      const result = await getCampaignPerformance("c1");
      expect(result.submittedApplications).toBe(3);
      expect(leadCount).toHaveBeenCalledWith({
        where: { campaignId: "c1", applicationStatus: "submitted" },
      });
    });

    it("excludes non-submitted Leads from the submitted count via the query itself", async () => {
      leadCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        "applicationStatus" in where ? 0 : 5,
      );

      const result = await getCampaignPerformance("c1");
      expect(result.submittedApplications).toBe(0);
    });
  });

  describe("sales", () => {
    it("reports the won count", async () => {
      saleCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        where.status === "won" ? 4 : 1,
      );

      const result = await getCampaignPerformance("c1");
      expect(result.wonSales).toBe(4);
      expect(saleCount).toHaveBeenCalledWith({ where: { campaignId: "c1", status: "won" } });
    });

    it("reports the lost count", async () => {
      saleCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        where.status === "won" ? 4 : 1,
      );

      const result = await getCampaignPerformance("c1");
      expect(result.lostSales).toBe(1);
      expect(saleCount).toHaveBeenCalledWith({ where: { campaignId: "c1", status: "lost" } });
    });

    it("reports totalSales as won + lost", async () => {
      saleCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        where.status === "won" ? 4 : 1,
      );

      const result = await getCampaignPerformance("c1");
      expect(result.totalSales).toBe(5);
    });

    it("reports zero for a Campaign with Leads but no Sales", async () => {
      leadCount.mockResolvedValue(20);
      saleCount.mockResolvedValue(0);

      const result = await getCampaignPerformance("c1");
      expect(result.totalLeads).toBe(20);
      expect(result.wonSales).toBe(0);
      expect(result.lostSales).toBe(0);
      expect(result.totalSales).toBe(0);
      expect(result.winRate).toBe(0);
      expect(result.totalSalesValue).toBe("0.00");
    });
  });

  describe("win rate", () => {
    it("calculates a normal win rate", async () => {
      saleCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        where.status === "won" ? 2 : 1,
      );

      const result = await getCampaignPerformance("c1");
      expect(result.winRate).toBeCloseTo(0.6667, 4);
    });

    it("returns 0 when there are zero sales", async () => {
      saleCount.mockResolvedValue(0);
      const result = await getCampaignPerformance("c1");
      expect(result.winRate).toBe(0);
    });

    it("returns 0 when there are only lost sales", async () => {
      saleCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        where.status === "won" ? 0 : 5,
      );

      const result = await getCampaignPerformance("c1");
      expect(result.wonSales).toBe(0);
      expect(result.lostSales).toBe(5);
      expect(result.winRate).toBe(0);
    });

    it("returns 1 when all sales are won", async () => {
      saleCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        where.status === "won" ? 5 : 0,
      );

      const result = await getCampaignPerformance("c1");
      expect(result.lostSales).toBe(0);
      expect(result.winRate).toBe(1);
    });

    it("never returns NaN or Infinity", async () => {
      saleCount.mockResolvedValue(0);
      const result = await getCampaignPerformance("c1");
      expect(Number.isFinite(result.winRate)).toBe(true);
      expect(Number.isNaN(result.winRate)).toBe(false);
    });
  });

  describe("sales value", () => {
    it("sums multiple won sale values correctly", async () => {
      saleAggregate.mockResolvedValue({ _sum: { saleValue: new Prisma.Decimal("300.50") } });

      const result = await getCampaignPerformance("c1");
      expect(result.totalSalesValue).toBe("300.50");
    });

    it("only aggregates won sales (lost excluded by the query)", async () => {
      await getCampaignPerformance("c1");
      expect(saleAggregate).toHaveBeenCalledWith({
        where: { campaignId: "c1", status: "won" },
        _sum: { saleValue: true },
      });
    });

    it("returns '0.00' when there are no won sales", async () => {
      saleAggregate.mockResolvedValue({ _sum: { saleValue: null } });
      const result = await getCampaignPerformance("c1");
      expect(result.totalSalesValue).toBe("0.00");
    });

    it("returns '0.00' for a Campaign with only lost sales", async () => {
      saleCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        where.status === "won" ? 0 : 3,
      );
      saleAggregate.mockResolvedValue({ _sum: { saleValue: null } });

      const result = await getCampaignPerformance("c1");
      expect(result.totalSalesValue).toBe("0.00");
    });

    it("uses Decimal-safe formatting, not Float", async () => {
      saleAggregate.mockResolvedValue({ _sum: { saleValue: new Prisma.Decimal("125000") } });
      const result = await getCampaignPerformance("c1");
      expect(result.totalSalesValue).toBe("125000.00");
    });
  });

  describe("isolation", () => {
    it("scopes every query to the requested campaignId", async () => {
      await getCampaignPerformance("c1");

      expect(leadCount).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ campaignId: "c1" }) }));
      expect(saleCount).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ campaignId: "c1" }) }));
      expect(saleAggregate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ campaignId: "c1" }) }));
    });

    it("never queries by any campaignId other than the one requested", async () => {
      await getCampaignPerformance("campaign-a");

      for (const call of [...leadCount.mock.calls, ...saleCount.mock.calls, ...saleAggregate.mock.calls]) {
        expect((call[0] as { where: { campaignId: string } }).where.campaignId).toBe("campaign-a");
      }
    });
  });
});
