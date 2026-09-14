import { prisma } from "@/server/db/client";
import { logActivity, type Actor } from "@/lib/actor";
import { Prisma, ContentSetStatus } from "@prisma/client";
import { getCampaignBrief, CampaignNotFoundError } from "@/server/services/campaign-service";
import {
  getApprovedMarketingStrategy,
  MarketingStrategyNotApprovedError,
} from "@/server/services/marketing-strategy-service";
import { generateStructuredCompletion, AiProviderError } from "@/server/ai/anthropic-client";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type ContentGenerationInput,
} from "@/server/ai/prompts/content-set-prompt";
import {
  contentSetOutputSchema,
  type ContentSetOutput,
} from "@/server/ai/schemas/content-set-output";
import { marketingStrategyOutputSchema } from "@/server/ai/schemas/marketing-strategy-output";

export type { ContentGenerationInput };

// Scoped to this service file, not shared with marketing-strategy-service.ts
// — matches the existing convention of one error family per service file.
export class ContentGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentGenerationError";
  }
}

export class ContentSetNotFoundError extends Error {
  constructor(campaignId: string) {
    super(`No content set has been generated yet for campaign ${campaignId}.`);
    this.name = "ContentSetNotFoundError";
  }
}

export class ContentSetNotEditableError extends Error {
  constructor(contentSetId: string, status: ContentSetStatus) {
    super(
      `Content set ${contentSetId} is "${status}" — only draft content sets can be edited or approved.`,
    );
    this.name = "ContentSetNotEditableError";
  }
}

export class ContentSetContentInvalidError extends Error {
  constructor(contentSetId: string) {
    super(`Content set ${contentSetId} has content that fails validation and cannot be approved.`);
    this.name = "ContentSetContentInvalidError";
  }
}

export class ContentSetNotApprovedError extends Error {
  constructor(campaignId: string) {
    super(`Campaign ${campaignId} does not have an approved content set yet.`);
    this.name = "ContentSetNotApprovedError";
  }
}

function buildContentGenerationInput(
  brief: { campaignId: string; productPromotion: string; officialPricing: Prisma.JsonValue; differentiators: Prisma.JsonValue },
  strategyContent: ContentGenerationInput["strategy"],
): ContentGenerationInput {
  const officialPricing =
    brief.officialPricing && typeof brief.officialPricing === "object" && !Array.isArray(brief.officialPricing)
      ? (brief.officialPricing as { amount?: number; currency?: string; terms?: string })
      : {};

  const differentiators = Array.isArray(brief.differentiators)
    ? (brief.differentiators as unknown[]).filter((d): d is string => typeof d === "string")
    : [];

  return {
    campaignId: brief.campaignId,
    productPromotion: brief.productPromotion,
    officialPricing,
    differentiators,
    strategy: strategyContent,
  };
}

const MAX_ATTEMPTS = 2;
// Four platforms' worth of variants is a larger response than the strategy
// generation call — sized up accordingly.
const MAX_OUTPUT_TOKENS = 4096;

// Independent copy of the same bounded retry policy used in
// marketing-strategy-service.ts (not shared, to avoid coupling this new
// service to that "stable" file) — exactly one retry, regardless of failure
// category, at most 2 total calls to the AI provider.
async function callAiWithRetry(input: ContentGenerationInput): Promise<ContentSetOutput> {
  const system = buildSystemPrompt();
  const prompt = buildUserPrompt(input);

  let lastErrorMessage = "Unknown error.";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const isLastAttempt = attempt === MAX_ATTEMPTS;

    let raw: string;
    try {
      raw = await generateStructuredCompletion({ system, prompt, maxTokens: MAX_OUTPUT_TOKENS });
    } catch (err) {
      if (err instanceof AiProviderError) {
        lastErrorMessage = err.message;
        if (!err.retryable || isLastAttempt) {
          throw new ContentGenerationError(`AI provider error: ${lastErrorMessage}`);
        }
        continue;
      }
      throw err;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      lastErrorMessage = "AI response was not valid JSON.";
      if (isLastAttempt) {
        throw new ContentGenerationError(lastErrorMessage);
      }
      continue;
    }

    const result = contentSetOutputSchema.safeParse(parsed);
    if (!result.success) {
      lastErrorMessage = `AI response failed schema validation: ${result.error.message}`;
      if (isLastAttempt) {
        throw new ContentGenerationError(lastErrorMessage);
      }
      continue;
    }

    return result.data;
  }

  // Unreachable — the loop above always returns or throws — but keeps the
  // function's return type honest for TypeScript.
  throw new ContentGenerationError(lastErrorMessage);
}

// Generates a new ContentSet version for a campaign whose marketing
// strategy is approved. Never mutates Campaign/Dataset/Building/
// MarketingStrategy rows — read-only against all of Phase 1 and Phase 2A.
// - Guard: getApprovedMarketingStrategy() (reused as-is) enforces both
//   "campaign confirmed" and "strategy approved" in one call.
// - The created ContentSet references the exact approved MarketingStrategy
//   row (id) used — if the approved strategy is later re-approved as a new
//   version, the next generation call naturally picks that up and records
//   the new id.
// - Regeneration archives the current draft (if any) and creates the next
//   version; an already-approved ContentSet is left untouched.
export async function generateContentSet(campaignId: string, actor: Actor) {
  // Throws CampaignNotFoundError / MarketingStrategyNotApprovedError —
  // reused exactly as-is from Phase 2A.3.
  const approvedStrategy = await getApprovedMarketingStrategy(campaignId);

  const strategyContentParsed = marketingStrategyOutputSchema.safeParse(approvedStrategy.content);
  if (!strategyContentParsed.success) {
    throw new ContentGenerationError(
      `Approved marketing strategy ${approvedStrategy.id} has content that fails validation.`,
    );
  }

  // getCampaignBrief() requires a confirmed-or-later campaign — already
  // guaranteed true here, since an approved strategy can only exist for a
  // confirmed campaign.
  const brief = await getCampaignBrief(campaignId);
  const input = buildContentGenerationInput(brief, strategyContentParsed.data);

  let output: ContentSetOutput;
  try {
    output = await callAiWithRetry(input);
  } catch (err) {
    await logActivity({
      entityType: "campaign",
      entityId: campaignId,
      action: "content_generation_failed",
      actor: { type: "ai", id: null },
      metadata: { reason: err instanceof Error ? err.message : "Unknown error" },
    });
    throw err;
  }

  const latestVersion = await prisma.contentSet.findFirst({
    where: { campaignId },
    orderBy: { version: "desc" },
    select: { id: true, version: true, status: true },
  });
  const nextVersion = (latestVersion?.version ?? 0) + 1;

  const contentSet = await prisma.$transaction(async (tx) => {
    if (latestVersion && latestVersion.status === ContentSetStatus.draft) {
      await tx.contentSet.update({
        where: { id: latestVersion.id },
        data: { status: ContentSetStatus.archived },
      });
    }

    return tx.contentSet.create({
      data: {
        campaignId,
        marketingStrategyId: approvedStrategy.id,
        version: nextVersion,
        status: ContentSetStatus.draft,
        content: output as unknown as Prisma.InputJsonValue,
        inputSnapshot: input as unknown as Prisma.InputJsonValue,
        generatedById: actor.id,
      },
    });
  });

  await logActivity({
    entityType: "content_set",
    entityId: contentSet.id,
    action: "content_generated",
    actor: { type: "ai", id: null },
    metadata: { campaignId, version: contentSet.version, marketingStrategyId: approvedStrategy.id },
  });

  return contentSet;
}

// Passive read — no activity logging (matches the existing convention: GET
// views are never logged).
export async function getLatestContentSet(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) throw new CampaignNotFoundError(campaignId);

  const contentSet = await prisma.contentSet.findFirst({
    where: { campaignId },
    orderBy: { version: "desc" },
  });
  if (!contentSet) throw new ContentSetNotFoundError(campaignId);

  return contentSet;
}

// Human edit of a draft content set. Never overwrites the edited version —
// archives it and creates a new one, the same versioning mechanic
// generateContentSet() already uses (kept as its own independent copy here
// rather than a shared helper, so the generation path is not touched at
// all). Only the campaign's current, still-draft, latest version may be
// edited — not an approved or archived one, and not a stale draft that's
// already been superseded.
//
// marketingStrategyId is preserved unchanged from the edited version —
// editing is a human refinement of existing content, not a new act of
// generation, so it never re-derives strategy provenance. Only
// generateContentSet() (a fresh AI call against whatever is *currently*
// approved) can produce a ContentSet against a different MarketingStrategy.
export async function editContentSet(
  campaignId: string,
  contentSetId: string,
  content: ContentSetOutput,
  actor: Actor,
) {
  const contentSet = await prisma.contentSet.findUnique({ where: { id: contentSetId } });
  if (!contentSet || contentSet.campaignId !== campaignId) {
    throw new ContentSetNotFoundError(campaignId);
  }

  const latest = await prisma.contentSet.findFirst({
    where: { campaignId },
    orderBy: { version: "desc" },
    select: { id: true },
  });

  if (contentSet.status !== ContentSetStatus.draft || latest?.id !== contentSet.id) {
    throw new ContentSetNotEditableError(contentSetId, contentSet.status);
  }

  const nextVersion = contentSet.version + 1;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.contentSet.update({
      where: { id: contentSet.id },
      data: { status: ContentSetStatus.archived },
    });

    return tx.contentSet.create({
      data: {
        campaignId,
        marketingStrategyId: contentSet.marketingStrategyId,
        version: nextVersion,
        status: ContentSetStatus.draft,
        content: content as unknown as Prisma.InputJsonValue,
        // Editing doesn't re-run generation — the snapshot that produced
        // the original AI content carries over unchanged.
        inputSnapshot: contentSet.inputSnapshot as unknown as Prisma.InputJsonValue,
        generatedById: actor.id,
      },
    });
  });

  await logActivity({
    entityType: "content_set",
    entityId: updated.id,
    action: "content_edited",
    actor,
    metadata: { campaignId, previousVersion: contentSet.version, newVersion: updated.version },
  });

  return updated;
}

// Approves a draft content set in place (no new version) and archives
// whatever other version currently holds "approved" for this campaign,
// atomically. Approved content is then immutable — the same status check
// that blocks editing an approved/archived set also blocks re-approving or
// approving an archived one.
export async function approveContentSet(campaignId: string, contentSetId: string, actor: Actor) {
  const contentSet = await prisma.contentSet.findUnique({ where: { id: contentSetId } });
  if (!contentSet || contentSet.campaignId !== campaignId) {
    throw new ContentSetNotFoundError(campaignId);
  }

  if (contentSet.status !== ContentSetStatus.draft) {
    throw new ContentSetNotEditableError(contentSetId, contentSet.status);
  }

  const parsedContent = contentSetOutputSchema.safeParse(contentSet.content);
  if (!parsedContent.success) {
    throw new ContentSetContentInvalidError(contentSetId);
  }

  const approved = await prisma.$transaction(async (tx) => {
    await tx.contentSet.updateMany({
      where: { campaignId, status: ContentSetStatus.approved },
      data: { status: ContentSetStatus.archived },
    });

    return tx.contentSet.update({
      where: { id: contentSet.id },
      data: {
        status: ContentSetStatus.approved,
        approvedById: actor.id,
        approvedAt: new Date(),
      },
    });
  });

  await logActivity({
    entityType: "content_set",
    entityId: approved.id,
    action: "content_approved",
    actor,
    metadata: { campaignId, version: approved.version },
  });

  return approved;
}

// The only interface Phase 2D is meant to call. Returns the approved
// version only — never a draft — so ad launch can never accidentally run
// against unreviewed content. Pure read, no writes.
export async function getApprovedContentSet(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) throw new CampaignNotFoundError(campaignId);

  const contentSet = await prisma.contentSet.findFirst({
    where: { campaignId, status: ContentSetStatus.approved },
  });
  if (!contentSet) throw new ContentSetNotApprovedError(campaignId);

  return contentSet;
}

export { MarketingStrategyNotApprovedError };
