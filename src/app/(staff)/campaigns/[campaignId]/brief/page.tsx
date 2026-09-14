import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { requireHumanActor, UnauthenticatedError } from "@/lib/actor";
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

export default async function CampaignBriefPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  try {
    await requireHumanActor();
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/login");
    }
    throw err;
  }

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
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold">Campaign Brief</h1>
      <p className="mb-6 text-sm text-gray-500 capitalize">Status: {brief.status}</p>

      <div className="flex flex-col gap-6">
        <section className="rounded border border-gray-200 p-4">
          <p className="mb-2 text-sm font-medium">Product / Pricing / Promotion</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-gray-500">Product / Promotion</dt>
            <dd>{brief.productPromotion}</dd>
            <dt className="text-gray-500">Official Pricing</dt>
            <dd>
              {officialPricing.amount ?? "—"} {officialPricing.currency ?? ""}
              {officialPricing.terms ? ` · ${officialPricing.terms}` : ""}
            </dd>
          </dl>
        </section>

        <section className="rounded border border-gray-200 p-4">
          <p className="mb-2 text-sm font-medium">Differentiators</p>
          {differentiators.length === 0 ? (
            <p className="text-sm text-gray-500">None.</p>
          ) : (
            <ul className="list-inside list-disc text-sm">
              {differentiators.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded border border-gray-200 p-4">
          <p className="mb-2 text-sm font-medium">
            Selected Dataset(s) ({brief.datasets.length})
          </p>
          <ul className="divide-y divide-gray-200">
            {brief.datasets.map((d) => (
              <li key={d.datasetId} className="py-2 text-sm">
                <span className="font-medium">{d.name}</span>
                <span className="ml-2 text-gray-500">
                  {d.sourceFilename} · {d.rowCount} total rows · {d.selectedBuildingCount} selected
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded border border-gray-200 p-4">
          <p className="mb-3 text-sm font-medium">
            Targeting Summary — {brief.targetingAnalysis.totalSelectedBuildings} building(s)
            selected across {brief.targetingAnalysis.datasetCount} dataset(s)
          </p>
          <div className="flex flex-col gap-4">
            {brief.targetingAnalysis.byDataset.map((d) => (
              <div key={d.datasetId} className="rounded border border-gray-100 p-3">
                <p className="mb-1 text-sm font-medium text-gray-700">
                  {d.datasetName} — {d.buildingCount} building(s)
                </p>
                <p className="text-sm text-gray-600">
                  {d.buildingsWithAddress} with an address · {d.buildingsWithCoordinates} with
                  coordinates
                </p>
                {d.availableAttributeKeys.length > 0 && (
                  <p className="mt-1 text-sm text-gray-500">
                    Available attributes: {d.availableAttributeKeys.join(", ")}
                  </p>
                )}
                {Object.entries(d.categoricalBreakdowns).map(([key, counts]) => (
                  <div key={key} className="mt-2 text-sm">
                    <p className="font-medium text-gray-700">{key}</p>
                    <ul className="list-inside list-disc text-gray-600">
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
        </section>

        <section className="rounded border border-gray-200 p-4">
          <p className="mb-3 text-sm font-medium">Marketing Strategy</p>
          {existingStrategy && (
            <p className="mb-3 text-sm text-gray-600">
              Current strategy:{" "}
              <Link href={`/campaigns/${campaignId}/strategy`} className="underline">
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
