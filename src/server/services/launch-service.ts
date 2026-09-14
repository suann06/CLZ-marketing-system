import { prisma } from "@/server/db/client";
import { logActivity, type Actor } from "@/lib/actor";
import { Prisma, LaunchStatus, type LaunchPlatform } from "@prisma/client";
import { getApprovedContentSet } from "@/server/services/content-generation-service";
import { contentSetOutputSchema, type ContentVariant } from "@/server/ai/schemas/content-set-output";
import { getProviderForPlatform } from "@/server/providers/ads/provider-registry";
import type { LaunchPlatformValue } from "@/server/providers/ads/provider-adapter";

export class LaunchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LaunchValidationError";
  }
}

const LAUNCH_PLATFORMS: readonly LaunchPlatformValue[] = ["facebook", "instagram", "tiktok"];

function isLaunchPlatform(value: string): value is LaunchPlatformValue {
  return (LAUNCH_PLATFORMS as readonly string[]).includes(value);
}

// Deterministic — derived only from what's being launched, not a random
// per-request token. This is the "logical launch target" identity used to
// detect duplicate attempts below.
function buildIdempotencyKey(
  campaignId: string,
  contentSetId: string,
  platform: LaunchPlatformValue,
  variantIndex: number,
): string {
  return `${campaignId}:${contentSetId}:${platform}:${variantIndex}`;
}

const NON_TERMINAL_OR_LIVE: LaunchStatus[] = [LaunchStatus.pending, LaunchStatus.launching, LaunchStatus.live];

// Requests a launch of one human-selected ContentVariant to one platform,
// from the campaign's currently approved ContentSet. Never mutates
// Campaign/ContentSet/MarketingStrategy — strictly read-only against all of
// Phase 1/2A/2B/2C.
//
// Returns a Launch row in EVERY outcome (live or failed) rather than
// throwing once the row exists — a failed attempt is deliberately
// preserved as history, not discarded. Only throws for precondition
// failures (bad platform/variant, no approved content) that happen before
// any row is created.
//
// Idempotency: see buildIdempotencyKey(). If a non-terminal or already-live
// Launch exists for the same logical target, it is returned as-is — no
// second provider call is made. A failed/cancelled attempt never blocks a
// fresh one; retrying always creates a brand new row, never overwriting the
// old one.
//
// Provider-call safety: the row is persisted with status "launching"
// BEFORE the provider is called, not after. If the process crashes between
// the provider call and recording its result, the row is left visibly
// "launching" — this is deliberately not disguised as success or silently
// retried. True exactly-once external side effects are not solved here;
// see docs/architecture.md-equivalent reasoning in the Phase 2D proposal.
export async function requestLaunch(
  campaignId: string,
  platform: string,
  variantIndex: number,
  actor: Actor,
) {
  if (!isLaunchPlatform(platform)) {
    throw new LaunchValidationError(
      `Invalid platform "${platform}". Must be one of: ${LAUNCH_PLATFORMS.join(", ")}.`,
    );
  }

  // Throws CampaignNotFoundError / ContentSetNotApprovedError — reused
  // exactly as-is from Phase 2C.
  const approvedContentSet = await getApprovedContentSet(campaignId);

  const parsedContent = contentSetOutputSchema.safeParse(approvedContentSet.content);
  if (!parsedContent.success) {
    throw new LaunchValidationError(
      `Approved content set ${approvedContentSet.id} has content that fails validation.`,
    );
  }

  const variants = parsedContent.data[platform];
  const selectedVariant: ContentVariant | undefined = variants[variantIndex];
  if (!selectedVariant) {
    throw new LaunchValidationError(`No variant at index ${variantIndex} for platform "${platform}".`);
  }

  const idempotencyKey = buildIdempotencyKey(campaignId, approvedContentSet.id, platform, variantIndex);

  const existing = await prisma.launch.findFirst({
    where: { idempotencyKey, status: { in: NON_TERMINAL_OR_LIVE } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return existing;
  }

  const launch = await prisma.launch.create({
    data: {
      campaignId,
      contentSetId: approvedContentSet.id,
      contentSetVersion: approvedContentSet.version,
      platform: platform as LaunchPlatform,
      variantIndex,
      selectedVariant: selectedVariant as unknown as Prisma.InputJsonValue,
      status: LaunchStatus.pending,
      idempotencyKey,
      createdById: actor.id,
    },
  });

  await logActivity({
    entityType: "launch",
    entityId: launch.id,
    action: "launch_requested",
    actor,
    metadata: { campaignId, platform, contentSetId: approvedContentSet.id, variantIndex },
  });

  const provider = getProviderForPlatform(platform);

  // Persisted before the provider call — see provider-call-safety note
  // above.
  await prisma.launch.update({
    where: { id: launch.id },
    data: { status: LaunchStatus.launching, provider: provider.providerName },
  });

  let result;
  try {
    result = await provider.launch({
      campaignId,
      contentSetId: approvedContentSet.id,
      platform,
      variantIndex,
      variant: selectedVariant,
    });
  } catch (err) {
    // A real provider's thrown exception (e.g. a network timeout) could
    // mean the external side effect actually succeeded but we never saw
    // the response — that ambiguity isn't resolvable here. For now this is
    // treated the same as a clean failure response; reconciling a
    // genuinely ambiguous real-provider outcome is future work once a real
    // adapter exists.
    result = {
      success: false as const,
      failureReason: err instanceof Error ? err.message : "Unknown provider error.",
    };
  }

  if (result.success) {
    const succeeded = await prisma.launch.update({
      where: { id: launch.id },
      data: {
        status: LaunchStatus.live,
        externalCampaignId: result.externalCampaignId,
        externalAdId: result.externalAdId,
        externalCreativeId: result.externalCreativeId,
        launchedAt: new Date(),
      },
    });

    await logActivity({
      entityType: "launch",
      entityId: succeeded.id,
      action: "launch_succeeded",
      actor: { type: "system", id: null },
      metadata: {
        campaignId,
        platform,
        externalCampaignId: result.externalCampaignId,
        externalAdId: result.externalAdId,
      },
    });

    return succeeded;
  }

  const failed = await prisma.launch.update({
    where: { id: launch.id },
    data: {
      status: LaunchStatus.failed,
      failureReason: result.failureReason,
    },
  });

  await logActivity({
    entityType: "launch",
    entityId: failed.id,
    action: "launch_failed",
    actor: { type: "system", id: null },
    metadata: { campaignId, platform, failureReason: result.failureReason },
  });

  return failed;
}

// Passive read — no activity logging.
export async function getLaunchesForCampaign(campaignId: string) {
  return prisma.launch.findMany({
    where: { campaignId },
    orderBy: [{ platform: "asc" }, { createdAt: "desc" }],
  });
}
