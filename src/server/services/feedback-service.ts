import { Prisma, SaleStatus } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { CampaignNotFoundError } from "@/server/services/campaign-service";
import { getCampaignPerformance } from "@/server/services/campaign-performance-service";
import { getAiProvider } from "@/server/providers/ai/provider-registry";
import {
  aiFeedbackExplanationOutputSchema,
  type AiFeedbackExplanationOutput,
} from "@/server/validation/ai-feedback-explanation-schema";

export type CampaignFeedbackItem = {
  leadId: string;
  outcome: "won" | "lost";
  saleValue: string | null;
  closedAt: Date;
};

// Pure read-only data extraction — no writes, no ActivityLog, no AI/
// provider call of any kind. Queries Sale directly (not Lead) so a Lead
// without a Sale simply never appears in the result; absence of a Sale is
// never interpreted as "lost". Every row's campaignId comes from the
// persisted Sale itself (scoped in the where clause), never inferred from
// caller input, so another campaign's Sales can never appear. Nothing is
// duplicated/stored — this always reflects whatever Sale currently holds,
// so a later correction (won -> lost, or a saleValue fix) is reflected on
// the very next call with no separate update step.
export async function getCampaignFeedbackData(campaignId: string): Promise<CampaignFeedbackItem[]> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) throw new CampaignNotFoundError(campaignId);

  const sales = await prisma.sale.findMany({
    where: { campaignId },
    select: { leadId: true, status: true, saleValue: true, closedAt: true },
  });

  return sales.map((sale) => ({
    leadId: sale.leadId,
    outcome: sale.status,
    saleValue: sale.saleValue ? sale.saleValue.toFixed(2) : null,
    closedAt: sale.closedAt,
  }));
}

// ---------------------------------------------------------------------
// Stage 11 — comparison / ranking. Deterministic, calculated entirely from
// existing persisted data (Campaign/Dataset/Launch/AcquisitionEvent/Lead/
// Sale) — no AI call, no fabricated "insight" text. Wording throughout
// uses "highest/lowest observed" rather than any causal claim ("caused",
// "resulted in") — these are correlational summaries of what already
// happened, not a prediction or explanation.
// ---------------------------------------------------------------------

export type ComparisonHighlight<T = number | string> = { id: string; value: T } | null;

// Picks the entry with the max/min `value(e)` among only entries that pass
// `eligible(e)` — an entry with no sample (e.g. zero clicks, zero sales)
// is never chosen, since its rate defaulting to 0 is "no data", not a
// genuine (and possibly misleadingly extreme) observation. Returns null
// when nothing is eligible, rather than fabricating a winner.
function pickExtreme<T>(
  entries: T[],
  idOf: (e: T) => string,
  value: (e: T) => number,
  eligible: (e: T) => boolean,
  direction: "max" | "min",
): ComparisonHighlight {
  const pool = entries.filter(eligible);
  if (pool.length === 0) return null;
  const chosen = pool.reduce((best, e) =>
    direction === "max" ? (value(e) > value(best) ? e : best) : value(e) < value(best) ? e : best,
  );
  return { id: idOf(chosen), value: value(chosen) };
}

export type CampaignComparisonEntry = {
  campaignId: string;
  campaignName: string;
  totalClicks: number;
  totalSales: number;
  wonSales: number;
  lostSales: number;
  winRate: number;
  totalSalesValue: string;
  overallClickToSaleRate: number;
};

export type CampaignComparison = {
  campaigns: CampaignComparisonEntry[];
  highestObservedWinRate: ComparisonHighlight;
  lowestObservedWinRate: ComparisonHighlight;
  highestObservedSalesValue: ComparisonHighlight;
  highestObservedClickToSaleRate: ComparisonHighlight;
};

// Reuses getCampaignPerformance() (Stage 10) per campaign rather than
// recomputing funnel logic here — "Do not duplicate functionality that
// already exists."
export async function compareCampaigns(): Promise<CampaignComparison> {
  const campaigns = await prisma.campaign.findMany({ select: { id: true, name: true } });

  const entries: CampaignComparisonEntry[] = await Promise.all(
    campaigns.map(async (c) => {
      const perf = await getCampaignPerformance(c.id);
      return {
        campaignId: c.id,
        campaignName: c.name,
        totalClicks: perf.totalClicks,
        totalSales: perf.totalSales,
        wonSales: perf.wonSales,
        lostSales: perf.lostSales,
        winRate: perf.winRate,
        totalSalesValue: perf.totalSalesValue,
        overallClickToSaleRate: perf.conversionRates.overallClickToSaleRate,
      };
    }),
  );

  const hasSales = (e: CampaignComparisonEntry) => e.totalSales > 0;
  const hasClicks = (e: CampaignComparisonEntry) => e.totalClicks > 0;
  const hasValue = (e: CampaignComparisonEntry) => Number(e.totalSalesValue) > 0;

  return {
    campaigns: entries,
    highestObservedWinRate: pickExtreme(entries, (e) => e.campaignId, (e) => e.winRate, hasSales, "max"),
    lowestObservedWinRate: pickExtreme(entries, (e) => e.campaignId, (e) => e.winRate, hasSales, "min"),
    highestObservedSalesValue: pickExtreme(
      entries,
      (e) => e.campaignId,
      (e) => Number(e.totalSalesValue),
      hasValue,
      "max",
    ),
    highestObservedClickToSaleRate: pickExtreme(
      entries,
      (e) => e.campaignId,
      (e) => e.overallClickToSaleRate,
      hasClicks,
      "max",
    ),
  };
}

export type DatasetComparisonEntry = {
  datasetId: string;
  datasetName: string;
  totalClicks: number;
  totalSales: number;
  wonSales: number;
  lostSales: number;
  winRate: number;
  totalSalesValue: string;
};

export type DatasetComparison = {
  datasets: DatasetComparisonEntry[];
  highestObservedWinRate: ComparisonHighlight;
  highestObservedSalesValue: ComparisonHighlight;
};

function moneySum(decimal: Prisma.Decimal | null): string {
  return (decimal ?? new Prisma.Decimal(0)).toFixed(2);
}

function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 10000;
}

// Compares every Dataset system-wide (across all campaigns that have used
// it) — Dataset.id is stable across campaigns (see Dataset's own doc
// comment: "never merged... against each other" refers to building data,
// not this system-wide performance rollup), unlike a creative, which
// belongs to exactly one campaign. Attribution comes only from
// AcquisitionEvent.datasetId — never guessed.
export async function compareDatasets(): Promise<DatasetComparison> {
  const datasets = await prisma.dataset.findMany({ select: { id: true, name: true } });

  const entries: DatasetComparisonEntry[] = await Promise.all(
    datasets.map(async (d) => {
      const saleScope = { lead: { acquisitionEvent: { datasetId: d.id } } };
      const [totalClicks, wonSales, lostSales, wonValueAgg] = await Promise.all([
        prisma.acquisitionEvent.count({ where: { datasetId: d.id } }),
        prisma.sale.count({ where: { ...saleScope, status: SaleStatus.won } }),
        prisma.sale.count({ where: { ...saleScope, status: SaleStatus.lost } }),
        prisma.sale.aggregate({ where: { ...saleScope, status: SaleStatus.won }, _sum: { saleValue: true } }),
      ]);
      const totalSales = wonSales + lostSales;

      return {
        datasetId: d.id,
        datasetName: d.name,
        totalClicks,
        totalSales,
        wonSales,
        lostSales,
        winRate: rate(wonSales, totalSales),
        totalSalesValue: moneySum(wonValueAgg._sum.saleValue),
      };
    }),
  );

  const hasSales = (e: DatasetComparisonEntry) => e.totalSales > 0;
  const hasValue = (e: DatasetComparisonEntry) => Number(e.totalSalesValue) > 0;

  return {
    datasets: entries,
    highestObservedWinRate: pickExtreme(entries, (e) => e.datasetId, (e) => e.winRate, hasSales, "max"),
    highestObservedSalesValue: pickExtreme(
      entries,
      (e) => e.datasetId,
      (e) => Number(e.totalSalesValue),
      hasValue,
      "max",
    ),
  };
}

export type CreativeComparisonEntry = {
  campaignId: string;
  contentSetId: string;
  contentSetVersion: number;
  platform: string;
  variantIndex: number;
  totalSales: number;
  wonSales: number;
  lostSales: number;
  winRate: number;
  totalSalesValue: string;
};

export type CreativeComparison = {
  creatives: CreativeComparisonEntry[];
  mostSales: ComparisonHighlight;
  highestObservedSalesValue: ComparisonHighlight;
  highestObservedWinRate: ComparisonHighlight;
};

type LaunchIdentity = {
  campaignId: string;
  contentSetId: string;
  contentSetVersion: number;
  platform: string;
  variantIndex: number;
};

function creativeKey(l: LaunchIdentity): string {
  return `${l.campaignId}:${l.contentSetId}:${l.contentSetVersion}:${l.platform}:${l.variantIndex}`;
}

// Compares every creative/version system-wide, across ALL campaigns —
// unlike Dataset, a ContentSet/Launch always belongs to exactly one
// Campaign, so campaignId stays part of the comparison identity. Multiple
// Launch rows sharing the same logical identity (a human retry — see
// launch-service.ts) are merged, same as getCreativePerformance().
export async function compareCreatives(): Promise<CreativeComparison> {
  const launches = await prisma.launch.findMany({
    select: { id: true, campaignId: true, contentSetId: true, contentSetVersion: true, platform: true, variantIndex: true },
  });

  const groups = new Map<string, LaunchIdentity & { launchIds: string[] }>();
  for (const l of launches) {
    const key = creativeKey(l);
    const existing = groups.get(key);
    if (existing) {
      existing.launchIds.push(l.id);
    } else {
      groups.set(key, {
        campaignId: l.campaignId,
        contentSetId: l.contentSetId,
        contentSetVersion: l.contentSetVersion,
        platform: l.platform,
        variantIndex: l.variantIndex,
        launchIds: [l.id],
      });
    }
  }

  const entries: CreativeComparisonEntry[] = await Promise.all(
    [...groups.values()].map(async (g) => {
      const saleScope = { lead: { acquisitionEvent: { launchId: { in: g.launchIds } } } };
      const [wonSales, lostSales, wonValueAgg] = await Promise.all([
        prisma.sale.count({ where: { ...saleScope, status: SaleStatus.won } }),
        prisma.sale.count({ where: { ...saleScope, status: SaleStatus.lost } }),
        prisma.sale.aggregate({ where: { ...saleScope, status: SaleStatus.won }, _sum: { saleValue: true } }),
      ]);
      const totalSales = wonSales + lostSales;

      return {
        campaignId: g.campaignId,
        contentSetId: g.contentSetId,
        contentSetVersion: g.contentSetVersion,
        platform: g.platform,
        variantIndex: g.variantIndex,
        totalSales,
        wonSales,
        lostSales,
        winRate: rate(wonSales, totalSales),
        totalSalesValue: moneySum(wonValueAgg._sum.saleValue),
      };
    }),
  );

  const idOf = (e: CreativeComparisonEntry) =>
    `${e.campaignId}:${e.contentSetId}:${e.contentSetVersion}:${e.platform}:${e.variantIndex}`;
  const hasSales = (e: CreativeComparisonEntry) => e.totalSales > 0;
  const hasValue = (e: CreativeComparisonEntry) => Number(e.totalSalesValue) > 0;

  return {
    creatives: entries,
    mostSales: pickExtreme(entries, idOf, (e) => e.totalSales, hasSales, "max"),
    highestObservedSalesValue: pickExtreme(entries, idOf, (e) => Number(e.totalSalesValue), hasValue, "max"),
    highestObservedWinRate: pickExtreme(entries, idOf, (e) => e.winRate, hasSales, "max"),
  };
}

export type FeedbackSummary = {
  generatedAt: string;
  topCampaigns: CampaignComparisonEntry[];
  topDatasets: DatasetComparisonEntry[];
  topCreatives: CreativeComparisonEntry[];
  signals: {
    highestObservedCampaignWinRate: ComparisonHighlight;
    highestObservedCampaignSalesValue: ComparisonHighlight;
    highestObservedDatasetWinRate: ComparisonHighlight;
    highestObservedCreativeWinRate: ComparisonHighlight;
  };
};

const TOP_N = 5;

// Compact, deterministic read model intended for future Stage 1–3
// consumption — a human reviewing this can decide what to change in the
// next campaign; nothing here writes back to Campaign/MarketingStrategy/
// ContentSet automatically. No AI-generated text anywhere in this output.
export async function getFeedbackSummary(): Promise<FeedbackSummary> {
  const [campaignComparison, datasetComparison, creativeComparison] = await Promise.all([
    compareCampaigns(),
    compareDatasets(),
    compareCreatives(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    topCampaigns: [...campaignComparison.campaigns]
      .sort((a, b) => Number(b.totalSalesValue) - Number(a.totalSalesValue))
      .slice(0, TOP_N),
    topDatasets: [...datasetComparison.datasets]
      .sort((a, b) => Number(b.totalSalesValue) - Number(a.totalSalesValue))
      .slice(0, TOP_N),
    topCreatives: [...creativeComparison.creatives]
      .sort((a, b) => Number(b.totalSalesValue) - Number(a.totalSalesValue))
      .slice(0, TOP_N),
    signals: {
      highestObservedCampaignWinRate: campaignComparison.highestObservedWinRate,
      highestObservedCampaignSalesValue: campaignComparison.highestObservedSalesValue,
      highestObservedDatasetWinRate: datasetComparison.highestObservedWinRate,
      highestObservedCreativeWinRate: creativeComparison.highestObservedWinRate,
    },
  };
}

export type FeedbackSummaryWithExplanation = FeedbackSummary & {
  // null whenever no explanation is available — the AI provider is
  // unavailable/throws, or its output fails validation (see
  // ai-feedback-explanation-schema.ts). Never a fatal condition: the
  // deterministic `summary`/`topCampaigns`/etc. fields above are always
  // present and correct regardless of this field.
  explanation: AiFeedbackExplanationOutput | null;
};

// Computes the deterministic Stage 11 summary FIRST, independent of any AI
// call, then optionally asks the AI provider to phrase an advisory
// explanation of those already-computed numbers (see
// AiFeedbackExplanationRequest's own doc comment — the AI never computes a
// metric itself). If the provider throws, or returns output that fails
// aiFeedbackExplanationOutputSchema (e.g. it slipped in causal language),
// `explanation` is simply null — this function never throws because of the
// AI step, and the rest of the summary is unaffected either way.
export async function getFeedbackSummaryWithExplanation(): Promise<FeedbackSummaryWithExplanation> {
  const summary = await getFeedbackSummary();

  let explanation: AiFeedbackExplanationOutput | null = null;
  try {
    const provider = getAiProvider();
    const raw = await provider.explainFeedback({
      topCampaigns: summary.topCampaigns,
      topDatasets: summary.topDatasets,
      topCreatives: summary.topCreatives,
      signals: summary.signals,
    });
    const parsed = aiFeedbackExplanationOutputSchema.safeParse(raw);
    if (parsed.success) {
      explanation = parsed.data;
    }
  } catch {
    explanation = null;
  }

  return { ...summary, explanation };
}
