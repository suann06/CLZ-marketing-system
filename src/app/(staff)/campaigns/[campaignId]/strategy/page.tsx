import { redirect, notFound } from "next/navigation";
import { requireHumanActor, UnauthenticatedError } from "@/lib/actor";
import { CampaignNotFoundError } from "@/server/services/campaign-service";
import {
  getLatestMarketingStrategy,
  MarketingStrategyNotFoundError,
} from "@/server/services/marketing-strategy-service";
import { marketingStrategyOutputSchema } from "@/server/ai/schemas/marketing-strategy-output";
import { StrategyReviewPanel } from "@/components/campaign/strategy/strategy-review-panel";
import {
  getLatestContentSet,
  ContentSetNotFoundError,
} from "@/server/services/content-generation-service";

export const dynamic = "force-dynamic";

export default async function CampaignStrategyPage({
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

  let strategy;
  try {
    strategy = await getLatestMarketingStrategy(campaignId);
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      notFound();
    }
    if (err instanceof MarketingStrategyNotFoundError) {
      redirect(`/campaigns/${campaignId}/brief`);
    }
    throw err;
  }

  const parsed = marketingStrategyOutputSchema.safeParse(strategy.content);
  if (!parsed.success) {
    // Should not happen — content is validated before it's ever saved — but
    // fail safely rather than crashing the page if it somehow did.
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-red-600">
          This strategy&apos;s stored content could not be displayed (unexpected shape).
        </p>
      </div>
    );
  }

  let existingContent: { version: number; status: string } | null = null;
  try {
    existingContent = await getLatestContentSet(campaignId);
  } catch (err) {
    if (!(err instanceof ContentSetNotFoundError)) {
      throw err;
    }
  }

  return (
    <StrategyReviewPanel
      campaignId={campaignId}
      strategyId={strategy.id}
      content={parsed.data}
      version={strategy.version}
      status={strategy.status}
      existingContent={existingContent}
    />
  );
}
