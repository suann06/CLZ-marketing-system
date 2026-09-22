import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  getCampaignBrief,
  CampaignNotFoundError,
  CampaignValidationError,
} from "@/server/services/campaign-service";
import {
  getLatestMarketingStrategy,
  MarketingStrategyNotFoundError,
} from "@/server/services/marketing-strategy-service";
import { GenerateStrategyButton } from "@/components/campaign/strategy/generate-strategy-button";

export const dynamic = "force-dynamic";

// Redesigned from "Campaign Brief" into "Overview" for the Campaign
// Workspace (Phase 4B), then again for Phase 5's visual identity — same
// getCampaignBrief() data throughout, only the presentation changed. Read-
// only info blocks are section headings + dividers, not five stacked
// Cards — a Card here would represent nothing genuinely separate.
export default async function CampaignOverviewPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  let brief;
  try {
    brief = await getCampaignBrief(campaignId);
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      notFound();
    }
    if (err instanceof CampaignValidationError) {
      // Not confirmed yet, or (unexpectedly) missing targeting data —
      // either way, Review is where that gets resolved.
      redirect(`/campaigns/${campaignId}/review`);
    }
    throw err;
  }

  const officialPricing =
    brief.officialPricing && typeof brief.officialPricing === "object"
      ? (brief.officialPricing as { amount?: number; currency?: string; terms?: string })
      : {};

  const differentiators = Array.isArray(brief.differentiators)
    ? (brief.differentiators as unknown[]).filter((d): d is string => typeof d === "string")
    : [];

  let existingStrategy: { version: number; status: string } | null = null;
  try {
    existingStrategy = await getLatestMarketingStrategy(campaignId);
  } catch (err) {
    if (!(err instanceof MarketingStrategyNotFoundError)) {
      throw err;
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h2 className="mb-8 text-lg font-semibold text-foreground">Overview</h2>

      <div className="flex flex-col divide-y divide-border">
        <section className="pb-8">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Product, pricing &amp; promotion</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-secondary">Product / promotion</dt>
            <dd className="text-foreground">{brief.productPromotion}</dd>
            <dt className="text-secondary">Official pricing</dt>
            <dd className="text-foreground">
              {officialPricing.amount ?? "—"} {officialPricing.currency ?? ""}
              {officialPricing.terms ? ` · ${officialPricing.terms}` : ""}
            </dd>
          </dl>
        </section>

        <section className="py-8">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Differentiators</h3>
          {differentiators.length === 0 ? (
            <p className="text-sm text-muted">None.</p>
          ) : (
            <ul className="list-inside list-disc text-sm text-secondary">
              {differentiators.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="py-8">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Targeting</h3>
          <p className="text-sm text-secondary">
            {brief.datasets.length} dataset{brief.datasets.length === 1 ? "" : "s"} ·{" "}
            {brief.targetingAnalysis.totalSelectedBuildings} building(s) selected. See{" "}
            <Link href={`/campaigns/${campaignId}/targeting`} className="text-primary hover:underline">
              Targeting &amp; Buildings
            </Link>{" "}
            for the full breakdown.
          </p>
        </section>

        <section className="pt-8">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Marketing strategy</h3>
          {existingStrategy && (
            <p className="mb-3 text-sm text-secondary">
              Current strategy:{" "}
              <Link href={`/campaigns/${campaignId}/strategy`} className="text-primary hover:underline">
                version {existingStrategy.version} ({existingStrategy.status})
              </Link>
            </p>
          )}
          <GenerateStrategyButton campaignId={campaignId} />
        </section>
      </div>
    </div>
  );
}
