import { redirect, notFound } from "next/navigation";
import { getCampaignDetail, CampaignNotFoundError } from "@/server/services/campaign-service";
import { ReviewStep, type ReviewBuildingGroup } from "@/components/campaign/wizard/review-step";
import { computeCompletedSteps } from "@/components/campaign/wizard/wizard-steps";

export const dynamic = "force-dynamic";

export default async function CampaignReviewPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  let detail;
  try {
    detail = await getCampaignDetail(campaignId);
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      notFound();
    }
    throw err;
  }

  if (detail.campaign.status !== "draft") {
    redirect("/campaigns");
  }

  const officialPricing =
    detail.campaign.officialPricing && typeof detail.campaign.officialPricing === "object"
      ? (detail.campaign.officialPricing as { amount?: number; currency?: string; terms?: string })
      : {};

  const differentiators = Array.isArray(detail.campaign.differentiators)
    ? (detail.campaign.differentiators as unknown[]).filter(
        (d): d is string => typeof d === "string",
      )
    : [];

  const datasetNames = detail.datasets.map((cd) => cd.dataset.name);

  const buildingGroups: ReviewBuildingGroup[] = detail.datasets.map((cd) => ({
    datasetId: cd.datasetId,
    datasetName: cd.dataset.name,
    buildingNames: detail.buildings
      .filter((cb) => cb.datasetId === cd.datasetId)
      .map((cb) => cb.building.name),
  }));

  return (
    <ReviewStep
      campaignId={campaignId}
      campaignName={detail.campaign.name}
      productPromotion={detail.campaign.productPromotion}
      officialPricing={officialPricing}
      differentiators={differentiators}
      datasetNames={datasetNames}
      buildingGroups={buildingGroups}
      totalBuildingCount={detail.buildings.length}
      completedSteps={computeCompletedSteps(detail)}
    />
  );
}
