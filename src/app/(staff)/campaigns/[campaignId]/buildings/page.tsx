import { redirect, notFound } from "next/navigation";
import { getCampaignDetail, CampaignNotFoundError } from "@/server/services/campaign-service";
import { getDatasetWithBuildings } from "@/server/services/dataset-service";
import { BuildingSelectStep } from "@/components/campaign/wizard/building-select-step";
import { computeCompletedSteps } from "@/components/campaign/wizard/wizard-steps";

export const dynamic = "force-dynamic";

export default async function CampaignBuildingsPage({
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

  // Building selection only makes sense for a still-editable draft campaign
  // — setCampaignBuildings() already enforces this on save, but a confirmed
  // campaign shouldn't even reach the selection UI.
  if (detail.campaign.status !== "draft") {
    redirect("/campaigns");
  }

  const selectedDatasetIds = detail.datasets.map((cd) => cd.datasetId);
  const initialSelectedBuildingIds = detail.buildings.map((cb) => cb.buildingId);

  const datasetGroups = (
    await Promise.all(selectedDatasetIds.map((id) => getDatasetWithBuildings(id)))
  )
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .map((d) => ({
      datasetId: d.id,
      datasetName: d.name,
      buildings: d.buildings.map((b) => ({ id: b.id, name: b.name, address: b.address })),
    }));

  return (
    <BuildingSelectStep
      campaignId={campaignId}
      campaignName={detail.campaign.name}
      datasetGroups={datasetGroups}
      initialSelectedBuildingIds={initialSelectedBuildingIds}
      completedSteps={computeCompletedSteps(detail)}
    />
  );
}
