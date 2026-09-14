import { notFound, redirect } from "next/navigation";
import { requireHumanActor, UnauthenticatedError } from "@/lib/actor";
import { CampaignNotFoundError, getCampaignDetail } from "@/server/services/campaign-service";
import {
  getApprovedMarketingStrategy,
  MarketingStrategyNotApprovedError,
} from "@/server/services/marketing-strategy-service";
import {
  getApprovedContentSet,
  ContentSetNotApprovedError,
} from "@/server/services/content-generation-service";
import { getLaunchesForCampaign } from "@/server/services/launch-service";
import { contentSetOutputSchema } from "@/server/ai/schemas/content-set-output";
import { LaunchPanel } from "@/components/campaign/launch/launch-panel";

export const dynamic = "force-dynamic";

export default async function CampaignLaunchPage({
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

  let detail;
  try {
    detail = await getCampaignDetail(campaignId);
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      notFound();
    }
    throw err;
  }

  let approvedStrategyVersion: number | null = null;
  try {
    const approvedStrategy = await getApprovedMarketingStrategy(campaignId);
    approvedStrategyVersion = approvedStrategy.version;
  } catch (err) {
    if (!(err instanceof MarketingStrategyNotApprovedError)) {
      throw err;
    }
  }

  let approvedContentSet;
  try {
    approvedContentSet = await getApprovedContentSet(campaignId);
  } catch (err) {
    if (err instanceof ContentSetNotApprovedError) {
      redirect(`/campaigns/${campaignId}/content`);
    }
    throw err;
  }

  const parsed = contentSetOutputSchema.safeParse(approvedContentSet.content);
  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-red-600">
          The approved content set&apos;s stored content could not be displayed (unexpected shape).
        </p>
      </div>
    );
  }

  const launches = await getLaunchesForCampaign(campaignId);

  return (
    <LaunchPanel
      campaignId={campaignId}
      campaignName={detail.campaign.name}
      productPromotion={detail.campaign.productPromotion}
      approvedStrategyVersion={approvedStrategyVersion}
      contentSetVersion={approvedContentSet.version}
      content={parsed.data}
      initialLaunches={launches.map((l) => ({
        id: l.id,
        platform: l.platform,
        variantIndex: l.variantIndex,
        status: l.status,
        provider: l.provider,
        externalCampaignId: l.externalCampaignId,
        externalAdId: l.externalAdId,
        externalCreativeId: l.externalCreativeId,
        failureReason: l.failureReason,
        launchedAt: l.launchedAt ? l.launchedAt.toISOString() : null,
        createdAt: l.createdAt.toISOString(),
      }))}
    />
  );
}
