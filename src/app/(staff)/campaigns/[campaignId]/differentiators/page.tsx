import { notFound } from "next/navigation";
import { getCampaignDetail, CampaignNotFoundError } from "@/server/services/campaign-service";
import { DifferentiatorsStep } from "@/components/campaign/wizard/differentiators-step";
import { computeCompletedSteps } from "@/components/campaign/wizard/wizard-steps";

export const dynamic = "force-dynamic";

export default async function CampaignDifferentiatorsPage({
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

  const initialDifferentiators = Array.isArray(detail.campaign.differentiators)
    ? (detail.campaign.differentiators as unknown[]).filter(
        (d): d is string => typeof d === "string",
      )
    : [];

  return (
    <DifferentiatorsStep
      campaignId={campaignId}
      campaignName={detail.campaign.name}
      initialDifferentiators={initialDifferentiators}
      completedSteps={computeCompletedSteps(detail)}
    />
  );
}
