import { notFound } from "next/navigation";
import { getCampaignDetail, CampaignNotFoundError } from "@/server/services/campaign-service";
import { listDatasets } from "@/server/services/dataset-service";
import { DatasetSelectStep } from "@/components/campaign/wizard/dataset-select-step";

export const dynamic = "force-dynamic";

export default async function CampaignDatasetsPage({
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

  const datasets = await listDatasets();
  const selectedIds = detail.datasets.map((cd) => cd.datasetId);

  return (
    <DatasetSelectStep
      campaignId={campaignId}
      campaignName={detail.campaign.name}
      initialDatasets={datasets.map((d) => ({
        id: d.id,
        name: d.name,
        sourceFilename: d.sourceFilename,
        rowCount: d.rowCount,
        importedAt: d.importedAt.toISOString(),
      }))}
      initialSelectedIds={selectedIds}
    />
  );
}
