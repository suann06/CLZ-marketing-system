import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  getCampaignBrief,
  CampaignNotFoundError,
  CampaignValidationError,
} from "@/server/services/campaign-service";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

// "Targeting & Buildings" — the new Dark Olive Luxury workspace tab
// (approved IA). Read-only, and deliberately NOT the existing
// /campaigns/:id/buildings route: that route is the Phase 4C wizard's
// building-*selection* UI, gated to draft campaigns only (it redirects
// confirmed campaigns to /campaigns) — reusing it as a persistent workspace
// tab would mean the tab redirects away for every already-confirmed
// campaign, which is the common case. This page instead reuses
// getCampaignBrief() (campaign-service.ts) — the same already-computed
// dataset/targeting data the Overview tab used to render inline — as its
// own tab. Same draft/confirmed handling as every other workspace tab
// (brief/page.tsx): a still-draft campaign redirects to /review, where
// dataset/building selection is actually edited.
export default async function CampaignTargetingPage({
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
      redirect(`/campaigns/${campaignId}/review`);
    }
    throw err;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-foreground">Targeting &amp; Buildings</h2>
        {brief.status === "draft" && (
          <Link href={`/campaigns/${campaignId}/buildings`} className="text-sm text-primary hover:underline">
            Edit selection
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <Card
          title={`Selected dataset${brief.datasets.length === 1 ? "" : "s"} (${brief.datasets.length})`}
        >
          <ul className="divide-y divide-border">
            {brief.datasets.map((d) => (
              <li key={d.datasetId} className="py-2.5 text-sm">
                <span className="font-medium text-foreground">{d.name}</span>
                <span className="ml-2 text-secondary">
                  {d.sourceFilename} · {d.rowCount} total rows · {d.selectedBuildingCount} selected
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title={`Targeting summary — ${brief.targetingAnalysis.totalSelectedBuildings} building(s) across ${brief.targetingAnalysis.datasetCount} dataset(s)`}
        >
          <div className="flex flex-col gap-5">
            {brief.targetingAnalysis.byDataset.map((d) => (
              <div key={d.datasetId}>
                <p className="mb-1 text-sm font-medium text-foreground">
                  {d.datasetName} — {d.buildingCount} building(s)
                </p>
                <p className="text-sm text-secondary">
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
                    <ul className="list-inside list-disc text-secondary">
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
      </div>
    </div>
  );
}
