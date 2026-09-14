import { describe, expect, it, vi, beforeEach } from "vitest";
import { CampaignStatus } from "@prisma/client";

// Prisma is fully mocked here — these tests never touch the real Supabase
// database or real project data, only the getCampaignBrief() guard logic
// and shape.
const { campaignFindUnique, campaignDatasetFindMany, campaignBuildingFindMany } = vi.hoisted(
  () => ({
    campaignFindUnique: vi.fn(),
    campaignDatasetFindMany: vi.fn(),
    campaignBuildingFindMany: vi.fn(),
  }),
);

vi.mock("@/server/db/client", () => ({
  prisma: {
    campaign: { findUnique: campaignFindUnique },
    campaignDataset: { findMany: campaignDatasetFindMany },
    campaignBuilding: { findMany: campaignBuildingFindMany },
  },
}));

vi.mock("@/lib/actor", () => ({
  logActivity: vi.fn(),
}));

import {
  getCampaignBrief,
  CampaignNotFoundError,
  CampaignValidationError,
} from "@/server/services/campaign-service";

describe("getCampaignBrief", () => {
  beforeEach(() => {
    campaignFindUnique.mockReset();
    campaignDatasetFindMany.mockReset();
    campaignBuildingFindMany.mockReset();
  });

  it("throws CampaignNotFoundError for a nonexistent campaign", async () => {
    campaignFindUnique.mockResolvedValue(null);

    await expect(getCampaignBrief("missing-id")).rejects.toBeInstanceOf(CampaignNotFoundError);
  });

  it("rejects a draft campaign", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1", status: CampaignStatus.draft });

    await expect(getCampaignBrief("c1")).rejects.toBeInstanceOf(CampaignValidationError);
  });

  it("throws when a confirmed campaign is missing required targeting data", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1", status: CampaignStatus.confirmed });
    campaignDatasetFindMany.mockResolvedValue([]);
    campaignBuildingFindMany.mockResolvedValue([]);

    await expect(getCampaignBrief("c1")).rejects.toBeInstanceOf(CampaignValidationError);
  });

  it("returns a structured brief for a confirmed campaign with targeting data", async () => {
    campaignFindUnique.mockResolvedValue({
      id: "c1",
      status: CampaignStatus.confirmed,
      productPromotion: "Fiber 100Mbps",
      officialPricing: { amount: 99, currency: "MYR" },
      differentiators: ["Free install"],
    });
    campaignDatasetFindMany.mockResolvedValue([
      {
        campaignId: "c1",
        datasetId: "d1",
        dataset: { id: "d1", name: "CBD Buildings", sourceFilename: "cbd.xlsx", rowCount: 2 },
      },
    ]);
    campaignBuildingFindMany.mockResolvedValue([
      {
        campaignId: "c1",
        datasetId: "d1",
        buildingId: "b1",
        building: {
          id: "b1",
          name: "Menara ABC",
          address: null,
          lat: null,
          lng: null,
          rawAttributes: { Category: "CAT 2 TIME" },
        },
      },
      {
        campaignId: "c1",
        datasetId: "d1",
        buildingId: "b2",
        building: {
          id: "b2",
          name: "Menara XYZ",
          address: "1 Jalan Test",
          lat: 3.1,
          lng: 101.6,
          rawAttributes: { Category: "CAT 2 TIME" },
        },
      },
    ]);

    const brief = await getCampaignBrief("c1");

    expect(brief.campaignId).toBe("c1");
    expect(brief.status).toBe(CampaignStatus.confirmed);
    expect(brief.productPromotion).toBe("Fiber 100Mbps");
    expect(brief.datasets).toHaveLength(1);
    expect(brief.datasets[0]).toMatchObject({
      datasetId: "d1",
      name: "CBD Buildings",
      selectedBuildingCount: 2,
    });
    expect(brief.targetingAnalysis.totalSelectedBuildings).toBe(2);
    expect(brief.targetingAnalysis.datasetCount).toBe(1);
    expect(brief.targetingAnalysis.byDataset[0].categoricalBreakdowns).toMatchObject({
      Category: { "CAT 2 TIME": 2 },
    });
  });
});
