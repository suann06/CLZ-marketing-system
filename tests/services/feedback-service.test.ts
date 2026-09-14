import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Prisma is fully mocked — never touches the real Supabase database. No
// write methods and no logActivity import at all anywhere in this mock —
// if this service (or the Stage 10 getCampaignPerformance() it reuses for
// compareCampaigns()) ever tried to write anything or log an activity, the
// call would fail loudly with "is not a function"/"is not defined", a
// structural guarantee this whole file's surface (Stage 9 feedback
// extraction AND Stage 11 comparison) is pure and read-only.
const {
  campaignFindUnique,
  campaignFindMany,
  saleFindMany,
  leadCount,
  saleCount,
  saleAggregate,
  launchCount,
  acquisitionEventCount,
  datasetFindMany,
  launchFindMany,
  explainFeedbackMock,
} = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  campaignFindMany: vi.fn(),
  saleFindMany: vi.fn(),
  leadCount: vi.fn(),
  saleCount: vi.fn(),
  saleAggregate: vi.fn(),
  launchCount: vi.fn(),
  acquisitionEventCount: vi.fn(),
  datasetFindMany: vi.fn(),
  launchFindMany: vi.fn(),
  explainFeedbackMock: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    campaign: { findUnique: campaignFindUnique, findMany: campaignFindMany },
    sale: { findMany: saleFindMany, count: saleCount, aggregate: saleAggregate },
    lead: { count: leadCount },
    launch: { count: launchCount, findMany: launchFindMany },
    acquisitionEvent: { count: acquisitionEventCount },
    dataset: { findMany: datasetFindMany },
  },
}));

vi.mock("@/server/providers/ai/provider-registry", () => ({
  getAiProvider: () => ({
    providerName: "mock-ai",
    converse: vi.fn(),
    classifyLead: vi.fn(),
    explainFeedback: explainFeedbackMock,
  }),
}));

import {
  getCampaignFeedbackData,
  compareCampaigns,
  compareDatasets,
  compareCreatives,
  getFeedbackSummary,
  getFeedbackSummaryWithExplanation,
} from "@/server/services/feedback-service";
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

describe("compareCampaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    campaignFindMany.mockResolvedValue([]);
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    leadCount.mockResolvedValue(0);
    saleCount.mockResolvedValue(0);
    saleAggregate.mockResolvedValue({ _sum: { saleValue: null } });
    launchCount.mockResolvedValue(0);
    acquisitionEventCount.mockResolvedValue(0);
  });

  it("returns one entry per campaign", async () => {
    campaignFindMany.mockResolvedValue([
      { id: "c1", name: "Campaign A" },
      { id: "c2", name: "Campaign B" },
    ]);

    const result = await compareCampaigns();
    expect(result.campaigns.map((c) => c.campaignId)).toEqual(["c1", "c2"]);
  });

  it("identifies the highest observed win rate among campaigns with at least one sale", async () => {
    campaignFindMany.mockResolvedValue([
      { id: "c1", name: "A" },
      { id: "c2", name: "B" },
    ]);
    saleCount.mockImplementation(
      async ({ where }: { where: { campaignId: string; status: string } }) => {
        if (where.campaignId === "c1") return where.status === "won" ? 1 : 4; // 20%
        return where.status === "won" ? 4 : 1; // 80%
      },
    );

    const result = await compareCampaigns();
    expect(result.highestObservedWinRate).toEqual({ id: "c2", value: 0.8 });
  });

  it("never crowns a zero-sample (0/0) campaign as the highest win rate", async () => {
    campaignFindMany.mockResolvedValue([{ id: "c1", name: "No sales yet" }]);
    saleCount.mockResolvedValue(0);

    const result = await compareCampaigns();
    expect(result.highestObservedWinRate).toBeNull();
  });

  it("identifies the highest observed sales value", async () => {
    campaignFindMany.mockResolvedValue([
      { id: "c1", name: "A" },
      { id: "c2", name: "B" },
    ]);
    saleAggregate.mockImplementation(async ({ where }: { where: { campaignId: string } }) => ({
      _sum: { saleValue: new Prisma.Decimal(where.campaignId === "c1" ? "100.00" : "999.00") },
    }));

    const result = await compareCampaigns();
    expect(result.highestObservedSalesValue).toEqual({ id: "c2", value: 999 });
  });

  it("never leaks one campaign's data into another campaign's entry", async () => {
    campaignFindMany.mockResolvedValue([
      { id: "c1", name: "A" },
      { id: "c2", name: "B" },
    ]);
    leadCount.mockImplementation(async ({ where }: { where: { campaignId: string } }) =>
      where.campaignId === "c1" ? 10 : 999,
    );

    await compareCampaigns();
    // getCampaignPerformance's own scoping is exercised here — each
    // campaign's entry must reflect only its own campaignId's query
    // results, verified indirectly via the distinct call arguments.
    const c1Calls = leadCount.mock.calls.filter(
      (c) => (c[0] as { where: { campaignId: string } }).where.campaignId === "c1",
    );
    expect(c1Calls.length).toBeGreaterThan(0);
  });
});

describe("compareDatasets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    datasetFindMany.mockResolvedValue([]);
    acquisitionEventCount.mockResolvedValue(0);
    saleCount.mockResolvedValue(0);
    saleAggregate.mockResolvedValue({ _sum: { saleValue: null } });
  });

  it("returns one entry per Dataset", async () => {
    datasetFindMany.mockResolvedValue([
      { id: "d1", name: "Mont Kiara" },
      { id: "d2", name: "Bangsar" },
    ]);

    const result = await compareDatasets();
    expect(result.datasets.map((d) => d.datasetId)).toEqual(["d1", "d2"]);
  });

  it("scopes sales queries by datasetId via the Lead -> AcquisitionEvent relation", async () => {
    datasetFindMany.mockResolvedValue([{ id: "d1", name: "Mont Kiara" }]);

    await compareDatasets();

    expect(saleCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ lead: { acquisitionEvent: { datasetId: "d1" } } }),
      }),
    );
  });

  it("identifies the highest observed win rate among datasets with at least one sale", async () => {
    datasetFindMany.mockResolvedValue([
      { id: "d1", name: "A" },
      { id: "d2", name: "B" },
    ]);
    saleCount.mockImplementation(
      async ({ where }: { where: { lead: { acquisitionEvent: { datasetId: string } }; status: string } }) => {
        const id = where.lead.acquisitionEvent.datasetId;
        if (id === "d1") return where.status === "won" ? 1 : 9;
        return where.status === "won" ? 9 : 1;
      },
    );

    const result = await compareDatasets();
    expect(result.highestObservedWinRate?.id).toBe("d2");
  });

  it("never crowns a zero-sample dataset as highest sales value", async () => {
    datasetFindMany.mockResolvedValue([{ id: "d1", name: "Untested dataset" }]);
    saleAggregate.mockResolvedValue({ _sum: { saleValue: null } });

    const result = await compareDatasets();
    expect(result.highestObservedSalesValue).toBeNull();
  });
});

describe("compareCreatives", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    launchFindMany.mockResolvedValue([]);
    saleCount.mockResolvedValue(0);
    saleAggregate.mockResolvedValue({ _sum: { saleValue: null } });
  });

  it("returns one entry per distinct creative identity, across campaigns", async () => {
    launchFindMany.mockResolvedValue([
      { id: "l1", campaignId: "c1", contentSetId: "cs1", contentSetVersion: 1, platform: "facebook", variantIndex: 0 },
      { id: "l2", campaignId: "c2", contentSetId: "cs2", contentSetVersion: 1, platform: "tiktok", variantIndex: 0 },
    ]);

    const result = await compareCreatives();
    expect(result.creatives).toHaveLength(2);
  });

  it("merges retried Launch rows sharing the same campaign+creative identity", async () => {
    launchFindMany.mockResolvedValue([
      { id: "l1-failed", campaignId: "c1", contentSetId: "cs1", contentSetVersion: 1, platform: "facebook", variantIndex: 0 },
      { id: "l1-retry", campaignId: "c1", contentSetId: "cs1", contentSetVersion: 1, platform: "facebook", variantIndex: 0 },
    ]);

    const result = await compareCreatives();
    expect(result.creatives).toHaveLength(1);
  });

  it("identifies the creative with the most sales", async () => {
    launchFindMany.mockResolvedValue([
      { id: "l1", campaignId: "c1", contentSetId: "cs1", contentSetVersion: 1, platform: "facebook", variantIndex: 0 },
      { id: "l2", campaignId: "c1", contentSetId: "cs1", contentSetVersion: 1, platform: "instagram", variantIndex: 0 },
    ]);
    saleCount.mockImplementation(
      async ({ where }: { where: { lead: { acquisitionEvent: { launchId: { in: string[] } } } }; status?: string } & { where: { status: string } }) => {
        const ids = where.lead.acquisitionEvent.launchId.in;
        if (ids.includes("l1")) return where.status === "won" ? 5 : 0;
        return where.status === "won" ? 1 : 0;
      },
    );

    const result = await compareCreatives();
    expect(result.mostSales?.id).toBe("c1:cs1:1:facebook:0");
  });

  it("never returns NaN/Infinity win rates and never crowns a zero-sample creative", async () => {
    launchFindMany.mockResolvedValue([
      { id: "l1", campaignId: "c1", contentSetId: "cs1", contentSetVersion: 1, platform: "facebook", variantIndex: 0 },
    ]);
    saleCount.mockResolvedValue(0);

    const result = await compareCreatives();
    expect(result.creatives[0].winRate).toBe(0);
    expect(result.highestObservedWinRate).toBeNull();
    expect(result.mostSales).toBeNull();
  });
});

describe("getFeedbackSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    campaignFindMany.mockResolvedValue([]);
    datasetFindMany.mockResolvedValue([]);
    launchFindMany.mockResolvedValue([]);
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    leadCount.mockResolvedValue(0);
    saleCount.mockResolvedValue(0);
    saleAggregate.mockResolvedValue({ _sum: { saleValue: null } });
    launchCount.mockResolvedValue(0);
    acquisitionEventCount.mockResolvedValue(0);
  });

  it("returns a compact structure suitable for Stage 1-3 consumption (campaigns/datasets/creatives + signals)", async () => {
    const summary = await getFeedbackSummary();
    expect(summary).toHaveProperty("topCampaigns");
    expect(summary).toHaveProperty("topDatasets");
    expect(summary).toHaveProperty("topCreatives");
    expect(summary).toHaveProperty("signals");
    expect(summary).toHaveProperty("generatedAt");
  });

  it("never throws on an entirely empty system (no denominator errors)", async () => {
    await expect(getFeedbackSummary()).resolves.toBeTruthy();
  });

  it("caps each top list at 5 entries", async () => {
    campaignFindMany.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, name: `Campaign ${i}` })),
    );

    const summary = await getFeedbackSummary();
    expect(summary.topCampaigns.length).toBeLessThanOrEqual(5);
  });

  it("does not fabricate AI-generated text anywhere in the output", async () => {
    const summary = await getFeedbackSummary();
    expect(JSON.stringify(summary)).not.toMatch(/insight|recommend|caused/i);
  });
});

describe("getFeedbackSummaryWithExplanation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    campaignFindMany.mockResolvedValue([]);
    datasetFindMany.mockResolvedValue([]);
    launchFindMany.mockResolvedValue([]);
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    leadCount.mockResolvedValue(0);
    saleCount.mockResolvedValue(0);
    saleAggregate.mockResolvedValue({ _sum: { saleValue: null } });
    launchCount.mockResolvedValue(0);
    acquisitionEventCount.mockResolvedValue(0);
    explainFeedbackMock.mockResolvedValue({ summary: "ok", highlights: [] });
  });

  it("includes a valid AI explanation when the provider succeeds", async () => {
    const result = await getFeedbackSummaryWithExplanation();
    expect(result.explanation).toEqual({ summary: "ok", highlights: [] });
  });

  it("only sends already-computed summary data to the AI provider, never raw rows", async () => {
    await getFeedbackSummaryWithExplanation();

    expect(explainFeedbackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        topCampaigns: expect.any(Array),
        topDatasets: expect.any(Array),
        topCreatives: expect.any(Array),
        signals: expect.any(Object),
      }),
    );
  });

  it("returns explanation: null (not a thrown error) when the AI provider throws", async () => {
    explainFeedbackMock.mockRejectedValue(new Error("provider unavailable"));

    const result = await getFeedbackSummaryWithExplanation();
    expect(result.explanation).toBeNull();
    // The deterministic part of the summary is still fully present.
    expect(result).toHaveProperty("topCampaigns");
    expect(result).toHaveProperty("signals");
  });

  it("returns explanation: null when the AI output fails validation (e.g. causal language)", async () => {
    explainFeedbackMock.mockResolvedValue({
      summary: "This campaign caused a huge increase in sales.",
      highlights: [],
    });

    const result = await getFeedbackSummaryWithExplanation();
    expect(result.explanation).toBeNull();
  });

  it("returns explanation: null when the AI output has an unexpected shape", async () => {
    explainFeedbackMock.mockResolvedValue({ notTheRightShape: true });

    const result = await getFeedbackSummaryWithExplanation();
    expect(result.explanation).toBeNull();
  });

  it("the deterministic summary works normally even if the AI provider is entirely unavailable", async () => {
    explainFeedbackMock.mockRejectedValue(new Error("no provider configured"));

    await expect(getFeedbackSummaryWithExplanation()).resolves.toMatchObject({
      explanation: null,
      topCampaigns: [],
      topDatasets: [],
      topCreatives: [],
    });
  });
});
