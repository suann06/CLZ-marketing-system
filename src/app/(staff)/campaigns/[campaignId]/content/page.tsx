import { notFound, redirect } from "next/navigation";
import { requireHumanActor, UnauthenticatedError } from "@/lib/actor";
import { CampaignNotFoundError } from "@/server/services/campaign-service";
import {
  getApprovedMarketingStrategy,
  MarketingStrategyNotApprovedError,
} from "@/server/services/marketing-strategy-service";
import {
  getLatestContentSet,
  ContentSetNotFoundError,
} from "@/server/services/content-generation-service";
import { contentSetOutputSchema } from "@/server/ai/schemas/content-set-output";
import { GenerateContentButton } from "@/components/campaign/content/generate-content-button";
import { ContentReviewPanel } from "@/components/campaign/content/content-review-panel";

export const dynamic = "force-dynamic";

export default async function CampaignContentPage({
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

  let contentSet;
  try {
    contentSet = await getLatestContentSet(campaignId);
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      notFound();
    }
    if (err instanceof ContentSetNotFoundError) {
      // No content generated yet. Only offer the entry point if the
      // campaign's strategy is actually approved — the backend enforces
      // this too (generateContentSet -> getApprovedMarketingStrategy), this
      // is purely a UX pre-check, not the security boundary.
      try {
        await getApprovedMarketingStrategy(campaignId);
      } catch (guardErr) {
        if (guardErr instanceof MarketingStrategyNotApprovedError) {
          redirect(`/campaigns/${campaignId}/strategy`);
        }
        if (guardErr instanceof CampaignNotFoundError) {
          notFound();
        }
        throw guardErr;
      }

      return (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="mb-1 text-xl font-semibold">Marketing Content</h1>
          <p className="mb-6 text-sm text-gray-500">No content has been generated yet.</p>
          <GenerateContentButton campaignId={campaignId} />
        </div>
      );
    }
    throw err;
  }

  const parsed = contentSetOutputSchema.safeParse(contentSet.content);
  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-red-600">
          This content set&apos;s stored content could not be displayed (unexpected shape).
        </p>
      </div>
    );
  }

  return (
    <ContentReviewPanel
      campaignId={campaignId}
      contentSetId={contentSet.id}
      content={parsed.data}
      version={contentSet.version}
      status={contentSet.status}
    />
  );
}
