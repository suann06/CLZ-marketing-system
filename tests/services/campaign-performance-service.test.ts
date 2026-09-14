import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Prisma is fully mocked — never touches the real Supabase database. The
// mocked client below deliberately exposes only the exact read methods
// this service is documented to use — no write methods at all — if this
// service ever tried to mutate anything, the call would fail loudly with
// "is not a function", a structural guarantee this is a pure, read-only,
// DB-side-aggregated calculation.
const {
  campaignFindUnique,
  leadCount,
  saleCount,
  saleAggregate,
  launchCount,
  acquisitionEventCount,
  campaignDatasetFindMany,
  launchFindMany,
} = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  leadCount: vi.fn(),
  saleCount: vi.fn(),
  saleAggregate: vi.fn(),
  launchCount: vi.fn(),
  acquisitionEventCount: vi.fn(),
  campaignDatasetFindMany: vi.fn(),
  launchFindMany: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    campaign: { findUnique: campaignFindUnique },
    lead: { count: leadCount },
    sale: { count: saleCount, aggregate: saleAggregate },
    launch: { count: launchCount, findMany: launchFindMany },
    acquisitionEvent: { count: acquisitionEventCount },
    campaignDataset: { findMany: campaignDatasetFindMany },
  },
}));

import {
  getCampaignPerformance,
  getDatasetPerformance,
  getCreativePerformance,
} from "@/server/services/campaign-performance-service";
import { CampaignNotFoundError } from "@/server/services/campaign-service";

describe("getCampaignPerformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    leadCount.mockResolvedValue(0);
    saleCount.mockResolvedValue(0);
    saleAggregate.mockResolvedValue({ _sum: { saleValue: null } });
    launchCount.mockResolvedValue(0);
    acquisitionEventCount.mockResolvedValue(0);
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

  describe("funnel counts", () => {
    it("reports totalAds from Launch rows", async () => {
      launchCount.mockResolvedValue(3);
      const result = await getCampaignPerformance("c1");
      expect(result.totalAds).toBe(3);
      expect(launchCount).toHaveBeenCalledWith({ where: { campaignId: "c1" } });
    });

    it("reports totalClicks from AcquisitionEvent rows", async () => {
      acquisitionEventCount.mockResolvedValue(50);
      const result = await getCampaignPerformance("c1");
      expect(result.totalClicks).toBe(50);
      expect(acquisitionEventCount).toHaveBeenCalledWith({ where: { campaignId: "c1" } });
    });

    it("reports the total lead count", async () => {
      leadCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        "applicationStatus" in where ? 3 : "messages" in where ? 8 : 10,
      );

      const result = await getCampaignPerformance("c1");
      expect(result.totalLeads).toBe(10);
      expect(leadCount).toHaveBeenCalledWith({ where: { campaignId: "c1" } });
    });

    it("reports totalWhatsAppEnquiries as Leads with an inbound message", async () => {
      leadCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        "messages" in where ? 8 : 10,
      );

      const result = await getCampaignPerformance("c1");
      expect(result.totalWhatsAppEnquiries).toBe(8);
      expect(leadCount).toHaveBeenCalledWith({
        where: { campaignId: "c1", messages: { some: { direction: "inbound" } } },
      });
    });

    it("reports the submitted-application count as totalApplications and submittedApplications", async () => {
      leadCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        "applicationStatus" in where && !("status" in where) ? 3 : 10,
      );

      const result = await getCampaignPerformance("c1");
      expect(result.submittedApplications).toBe(3);
      expect(result.totalApplications).toBe(3);
      expect(leadCount).toHaveBeenCalledWith({
        where: { campaignId: "c1", applicationStatus: "submitted" },
      });
    });

    it("excludes non-submitted Leads from the submitted count via the query itself", async () => {
      leadCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        "applicationStatus" in where && !("status" in where) ? 0 : 5,
      );

      const result = await getCampaignPerformance("c1");
      expect(result.submittedApplications).toBe(0);
    });

    it("reports totalQualifiedLeads matching isQualifiedLead's own definition (hot + submitted)", async () => {
      leadCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        "status" in where && "applicationStatus" in where ? 2 : 10,
      );

      const result = await getCampaignPerformance("c1");
      expect(result.totalQualifiedLeads).toBe(2);
      expect(leadCount).toHaveBeenCalledWith({
        where: { campaignId: "c1", status: "hot", applicationStatus: "submitted" },
      });
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

  describe("conversion rates", () => {
    it("computes clickToEnquiryRate, never NaN/Infinity on zero clicks", async () => {
      acquisitionEventCount.mockResolvedValue(0);
      const result = await getCampaignPerformance("c1");
      expect(result.conversionRates.clickToEnquiryRate).toBe(0);
    });

    it("computes a normal clickToEnquiryRate", async () => {
      acquisitionEventCount.mockResolvedValue(100);
      leadCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        "messages" in where ? 25 : 0,
      );

      const result = await getCampaignPerformance("c1");
      expect(result.conversionRates.clickToEnquiryRate).toBe(0.25);
    });

    it("computes qualifiedToSaleRate as totalSales / totalQualifiedLeads", async () => {
      leadCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        "status" in where && "applicationStatus" in where ? 4 : 0,
      );
      saleCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        where.status === "won" ? 1 : 1,
      );

      const result = await getCampaignPerformance("c1");
      expect(result.conversionRates.qualifiedToSaleRate).toBe(0.5);
    });

    it("does not expose a clickThroughRate field (no impression data exists)", async () => {
      const result = await getCampaignPerformance("c1");
      expect(result.conversionRates).not.toHaveProperty("clickThroughRate");
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

    it("uses Decimal-safe formatting, not Float", async () => {
      saleAggregate.mockResolvedValue({ _sum: { saleValue: new Prisma.Decimal("125000") } });
      const result = await getCampaignPerformance("c1");
      expect(result.totalSalesValue).toBe("125000.00");
    });
  });

  describe("isolation", () => {
    it("scopes every query to the requested campaignId", async () => {
      await getCampaignPerformance("c1");

      for (const call of [
        ...leadCount.mock.calls,
        ...saleCount.mock.calls,
        ...saleAggregate.mock.calls,
        ...launchCount.mock.calls,
        ...acquisitionEventCount.mock.calls,
      ]) {
        expect((call[0] as { where: { campaignId: string } }).where.campaignId).toBe("c1");
      }
    });
  });

  describe("data correctness (no caching)", () => {
    it("reflects a sale correction on the very next call, with no separate update step", async () => {
      saleAggregate.mockResolvedValue({ _sum: { saleValue: new Prisma.Decimal("100.00") } });
      const before = await getCampaignPerformance("c1");
      expect(before.totalSalesValue).toBe("100.00");

      // Simulates sale-service.ts's updateSaleOutcome() correcting the
      // saleValue — getCampaignPerformance() is never told to invalidate
      // anything; it just recomputes from Prisma on the next call.
      saleAggregate.mockResolvedValue({ _sum: { saleValue: new Prisma.Decimal("250.00") } });
      const after = await getCampaignPerformance("c1");
      expect(after.totalSalesValue).toBe("250.00");
    });
  });
});

describe("getDatasetPerformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    acquisitionEventCount.mockResolvedValue(0);
    leadCount.mockResolvedValue(0);
    saleCount.mockResolvedValue(0);
    saleAggregate.mockResolvedValue({ _sum: { saleValue: null } });
  });

  it("throws CampaignNotFoundError for a missing Campaign", async () => {
    campaignFindUnique.mockResolvedValue(null);
    await expect(getDatasetPerformance("missing")).rejects.toBeInstanceOf(CampaignNotFoundError);
  });

  it("returns an empty array for a campaign targeting no datasets", async () => {
    campaignDatasetFindMany.mockResolvedValue([]);
    const result = await getDatasetPerformance("c1");
    expect(result).toEqual([]);
  });

  it("returns one entry per targeted dataset with its name", async () => {
    campaignDatasetFindMany.mockResolvedValue([
      { campaignId: "c1", datasetId: "d1", dataset: { id: "d1", name: "Mont Kiara" } },
      { campaignId: "c1", datasetId: "d2", dataset: { id: "d2", name: "Bangsar" } },
    ]);

    const result = await getDatasetPerformance("c1");
    expect(result.map((r) => r.datasetId)).toEqual(["d1", "d2"]);
    expect(result[0].datasetName).toBe("Mont Kiara");
  });

  it("scopes every metric query to the correct datasetId via the AcquisitionEvent relation", async () => {
    campaignDatasetFindMany.mockResolvedValue([
      { campaignId: "c1", datasetId: "d1", dataset: { id: "d1", name: "Mont Kiara" } },
    ]);

    await getDatasetPerformance("c1");

    expect(acquisitionEventCount).toHaveBeenCalledWith({ where: { campaignId: "c1", datasetId: "d1" } });
    expect(leadCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ acquisitionEvent: { datasetId: "d1" } }),
      }),
    );
    expect(saleCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ lead: { acquisitionEvent: { datasetId: "d1" } } }),
      }),
    );
  });

  it("sums won sale value per dataset, excluding lost", async () => {
    campaignDatasetFindMany.mockResolvedValue([
      { campaignId: "c1", datasetId: "d1", dataset: { id: "d1", name: "Mont Kiara" } },
    ]);
    saleAggregate.mockResolvedValue({ _sum: { saleValue: new Prisma.Decimal("450.00") } });

    const [entry] = await getDatasetPerformance("c1");
    expect(entry.totalSalesValue).toBe("450.00");
    expect(saleAggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "won" }) }),
    );
  });
});

describe("getCreativePerformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    acquisitionEventCount.mockResolvedValue(0);
    leadCount.mockResolvedValue(0);
    saleCount.mockResolvedValue(0);
    saleAggregate.mockResolvedValue({ _sum: { saleValue: null } });
  });

  it("throws CampaignNotFoundError for a missing Campaign", async () => {
    campaignFindUnique.mockResolvedValue(null);
    await expect(getCreativePerformance("missing")).rejects.toBeInstanceOf(CampaignNotFoundError);
  });

  it("returns an empty array for a campaign with no launches", async () => {
    launchFindMany.mockResolvedValue([]);
    const result = await getCreativePerformance("c1");
    expect(result).toEqual([]);
  });

  it("identifies each creative by contentSetId/version/platform/variantIndex", async () => {
    launchFindMany.mockResolvedValue([
      { id: "launch-1", contentSetId: "cs1", contentSetVersion: 1, platform: "facebook", variantIndex: 0 },
    ]);

    const [entry] = await getCreativePerformance("c1");
    expect(entry).toMatchObject({
      campaignId: "c1",
      contentSetId: "cs1",
      contentSetVersion: 1,
      platform: "facebook",
      variantIndex: 0,
    });
  });

  it("merges retried Launch rows that share the same logical creative identity", async () => {
    launchFindMany.mockResolvedValue([
      { id: "launch-1-failed", contentSetId: "cs1", contentSetVersion: 1, platform: "facebook", variantIndex: 0 },
      { id: "launch-1-retry", contentSetId: "cs1", contentSetVersion: 1, platform: "facebook", variantIndex: 0 },
    ]);

    const result = await getCreativePerformance("c1");
    expect(result).toHaveLength(1);
    expect(acquisitionEventCount).toHaveBeenCalledWith({
      where: { campaignId: "c1", launchId: { in: ["launch-1-failed", "launch-1-retry"] } },
    });
  });

  it("keeps distinct creatives (different platform/variant) as separate entries", async () => {
    launchFindMany.mockResolvedValue([
      { id: "launch-1", contentSetId: "cs1", contentSetVersion: 1, platform: "facebook", variantIndex: 0 },
      { id: "launch-2", contentSetId: "cs1", contentSetVersion: 1, platform: "instagram", variantIndex: 0 },
    ]);

    const result = await getCreativePerformance("c1");
    expect(result).toHaveLength(2);
  });

  it("sums won sale value per creative, excluding lost", async () => {
    launchFindMany.mockResolvedValue([
      { id: "launch-1", contentSetId: "cs1", contentSetVersion: 1, platform: "facebook", variantIndex: 0 },
    ]);
    saleAggregate.mockResolvedValue({ _sum: { saleValue: new Prisma.Decimal("999.00") } });

    const [entry] = await getCreativePerformance("c1");
    expect(entry.salesValue).toBe("999.00");
  });
});
