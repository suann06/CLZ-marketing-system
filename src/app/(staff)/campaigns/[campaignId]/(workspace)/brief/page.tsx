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
import { PageContainer } from "@/components/layout/page-container";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

// Redesigned from "Campaign Brief" into "Overview" for the Campaign
// Workspace (Phase 4B) — same getCampaignBrief() data and the same
// GenerateStrategyButton behavior, only the presentation changed. Campaign
// name/status now live in the persistent workspace header, so this page no
// longer repeats them.
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
    <PageContainer maxWidth="max-w-3xl">
      <h2 className="mb-6 text-lg font-semibold">Overview</h2>

      <div className="flex flex-col gap-6">
        <Card title="Product / Pricing / Promotion">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Product / Promotion</dt>
            <dd>{brief.productPromotion}</dd>
            <dt className="text-muted">Official Pricing</dt>
            <dd>
              {officialPricing.amount ?? "—"} {officialPricing.currency ?? ""}
              {officialPricing.terms ? ` · ${officialPricing.terms}` : ""}
            </dd>
          </dl>
        </Card>

        <Card title="Differentiators">
          {differentiators.length === 0 ? (
            <p className="text-sm text-muted">None.</p>
          ) : (
            <ul className="list-inside list-disc text-sm">
              {differentiators.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Selected Dataset(s) (${brief.datasets.length})`}>
          <ul className="divide-y divide-border">
            {brief.datasets.map((d) => (
              <li key={d.datasetId} className="py-2 text-sm">
                <span className="font-medium">{d.name}</span>
                <span className="ml-2 text-muted">
                  {d.sourceFilename} · {d.rowCount} total rows · {d.selectedBuildingCount} selected
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title={`Targeting Summary — ${brief.targetingAnalysis.totalSelectedBuildings} building(s) selected across ${brief.targetingAnalysis.datasetCount} dataset(s)`}
        >
          <div className="flex flex-col gap-4">
            {brief.targetingAnalysis.byDataset.map((d) => (
              <div key={d.datasetId} className="rounded border border-border p-3">
                <p className="mb-1 text-sm font-medium text-foreground">
                  {d.datasetName} — {d.buildingCount} building(s)
                </p>
                <p className="text-sm text-muted">
                  {d.buildingsWithAddress} with an address · {d.buildingsWithCoordinates} with
                  coordinates
                </p>
                {d.availableAttributeKeys.length > 0 && (
                  <p className="mt-1 text-sm text-muted">
                    Available attributes: {d.availableAttributeKeys.join(", ")}
                  </p>
                )}
                {Object.entries(d.categoricalBreakdowns).map(([key, counts]) => (
                  <div key={key} className="mt-2 text-sm">
                    <p className="font-medium text-foreground">{key}</p>
                    <ul className="list-inside list-disc text-muted">
                      {Object.entries(counts).map(([value, count]) => (
                        <li key={value}>
                          {value}: {count}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Marketing Strategy">
          {existingStrategy && (
            <p className="mb-3 text-sm text-muted">
              Current strategy:{" "}
              <Link href={`/campaigns/${campaignId}/strategy`} className="underline">
                version {existingStrategy.version} ({existingStrategy.status})
              </Link>
            </p>
          )}
          <GenerateStrategyButton campaignId={campaignId} />
        </Card>
      </div>
    </PageContainer>
  );
}
