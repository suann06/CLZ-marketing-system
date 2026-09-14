import { prisma } from "@/server/db/client";
import { logActivity, type Actor } from "@/lib/actor";
import { Prisma, MarketingStrategyStatus } from "@prisma/client";
import { getCampaignBrief, CampaignNotFoundError, type CampaignBrief } from "@/server/services/campaign-service";
import { generateStructuredCompletion, AiProviderError } from "@/server/ai/anthropic-client";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type MarketingStrategyInput,
} from "@/server/ai/prompts/marketing-strategy-prompt";
import {
  marketingStrategyOutputSchema,
  type MarketingStrategyOutput,
} from "@/server/ai/schemas/marketing-strategy-output";

export type { MarketingStrategyInput };

export class AiGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiGenerationError";
  }
}

export class MarketingStrategyNotFoundError extends Error {
  constructor(campaignId: string) {
    super(`No marketing strategy has been generated yet for campaign ${campaignId}.`);
    this.name = "MarketingStrategyNotFoundError";
  }
}

export class MarketingStrategyNotEditableError extends Error {
  constructor(strategyId: string, status: MarketingStrategyStatus) {
    super(
      `Marketing strategy ${strategyId} is "${status}" — only draft strategies can be edited or approved.`,
    );
    this.name = "MarketingStrategyNotEditableError";
  }
}

export class MarketingStrategyContentInvalidError extends Error {
  constructor(strategyId: string) {
    super(`Marketing strategy ${strategyId} has content that fails validation and cannot be approved.`);
    this.name = "MarketingStrategyContentInvalidError";
  }
}

export class MarketingStrategyNotApprovedError extends Error {
  constructor(campaignId: string) {
    super(`Campaign ${campaignId} does not have an approved marketing strategy yet.`);
    this.name = "MarketingStrategyNotApprovedError";
  }
}

// campaign_id is the only Phase 1 backbone ID this service ever uses — it
// never queries Dataset/Building tables directly, only through the already
// Phase 1-frozen getCampaignBrief().
function buildMarketingStrategyInput(brief: CampaignBrief): MarketingStrategyInput {
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
    datasets: brief.datasets.map((d) => ({
      name: d.name,
      sourceFilename: d.sourceFilename,
      selectedBuildingCount: d.selectedBuildingCount,
    })),
    targetingAnalysis: brief.targetingAnalysis,
  };
}

const MAX_ATTEMPTS = 2;

// Exactly one retry, regardless of failure category (provider error vs.
// malformed/invalid content) — at most 2 total calls to the AI provider.
async function callAiWithRetry(input: MarketingStrategyInput): Promise<MarketingStrategyOutput> {
  const system = buildSystemPrompt();
  const prompt = buildUserPrompt(input);

  let lastErrorMessage = "Unknown error.";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const isLastAttempt = attempt === MAX_ATTEMPTS;

    let raw: string;
    try {
      raw = await generateStructuredCompletion({ system, prompt });
    } catch (err) {
      if (err instanceof AiProviderError) {
        lastErrorMessage = err.message;
        if (!err.retryable || isLastAttempt) {
          throw new AiGenerationError(`AI provider error: ${lastErrorMessage}`);
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
        throw new AiGenerationError(lastErrorMessage);
      }
      continue;
    }

    const result = marketingStrategyOutputSchema.safeParse(parsed);
    if (!result.success) {
      lastErrorMessage = `AI response failed schema validation: ${result.error.message}`;
      if (isLastAttempt) {
        throw new AiGenerationError(lastErrorMessage);
      }
      continue;
    }

    return result.data;
  }

  // Unreachable — the loop above always returns or throws — but keeps the
  // function's return type honest for TypeScript.
  throw new AiGenerationError(lastErrorMessage);
}

// Generates a new MarketingStrategy version for a confirmed campaign.
// - Never mutates Dataset/Building/Campaign rows — read-only against Phase 1.
// - Never overwrites a prior version; regenerating archives the previous
//   *draft* (if any) and creates a new version. An already-approved version
//   is left untouched until a future approval of a newer version archives it
//   (approval itself is out of scope for Phase 2A.2).
export async function generateMarketingStrategy(campaignId: string, actor: Actor) {
  // getCampaignBrief() already throws CampaignNotFoundError / CampaignValidationError
  // (draft campaign, or confirmed-but-missing-targeting-data) — reused as-is.
  const brief = await getCampaignBrief(campaignId);
  const input = buildMarketingStrategyInput(brief);

  let output: MarketingStrategyOutput;
  try {
    output = await callAiWithRetry(input);
  } catch (err) {
    await logActivity({
      entityType: "campaign",
      entityId: campaignId,
      action: "ai_strategy_generation_failed",
      actor: { type: "ai", id: null },
      metadata: { reason: err instanceof Error ? err.message : "Unknown error" },
    });
    throw err;
  }

  const latestVersion = await prisma.marketingStrategy.findFirst({
    where: { campaignId },
    orderBy: { version: "desc" },
    select: { id: true, version: true, status: true },
  });
  const nextVersion = (latestVersion?.version ?? 0) + 1;

  const strategy = await prisma.$transaction(async (tx) => {
    if (latestVersion && latestVersion.status === MarketingStrategyStatus.draft) {
      await tx.marketingStrategy.update({
        where: { id: latestVersion.id },
        data: { status: MarketingStrategyStatus.archived },
      });
    }

    return tx.marketingStrategy.create({
      data: {
        campaignId,
        version: nextVersion,
        status: MarketingStrategyStatus.draft,
        content: output as unknown as Prisma.InputJsonValue,
        inputSnapshot: input as unknown as Prisma.InputJsonValue,
        generatedById: actor.id,
      },
    });
  });

  await logActivity({
    entityType: "marketing_strategy",
    entityId: strategy.id,
    action: "ai_strategy_generated",
    actor: { type: "ai", id: null },
    metadata: { campaignId, version: strategy.version },
  });

  return strategy;
}

// Passive read — no activity logging (matches the existing convention: GET
// views are never logged).
export async function getLatestMarketingStrategy(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) throw new CampaignNotFoundError(campaignId);

  const strategy = await prisma.marketingStrategy.findFirst({
    where: { campaignId },
    orderBy: { version: "desc" },
  });
  if (!strategy) throw new MarketingStrategyNotFoundError(campaignId);

  return strategy;
}

// Human edit of a draft strategy. Never overwrites the edited version — it
// archives it and creates a new one, the same versioning mechanic
// generateMarketingStrategy() already uses (kept as separate code here
// rather than sharing a helper, so Phase 2A.2's generate path is not
// touched at all). Only the campaign's current, still-draft, latest version
// may be edited — not an approved or archived one, and not a stale draft
// that's already been superseded.
export async function editMarketingStrategy(
  campaignId: string,
  strategyId: string,
  content: MarketingStrategyOutput,
  actor: Actor,
) {
  const strategy = await prisma.marketingStrategy.findUnique({ where: { id: strategyId } });
  if (!strategy || strategy.campaignId !== campaignId) {
    throw new MarketingStrategyNotFoundError(campaignId);
  }

  const latest = await prisma.marketingStrategy.findFirst({
    where: { campaignId },
    orderBy: { version: "desc" },
    select: { id: true },
  });

  if (strategy.status !== MarketingStrategyStatus.draft || latest?.id !== strategy.id) {
    throw new MarketingStrategyNotEditableError(strategyId, strategy.status);
  }

  const nextVersion = strategy.version + 1;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.marketingStrategy.update({
      where: { id: strategy.id },
      data: { status: MarketingStrategyStatus.archived },
    });

    return tx.marketingStrategy.create({
      data: {
        campaignId,
        version: nextVersion,
        status: MarketingStrategyStatus.draft,
        content: content as unknown as Prisma.InputJsonValue,
        // Editing doesn't re-run getCampaignBrief() — the snapshot that
        // produced the original AI content carries over unchanged.
        inputSnapshot: strategy.inputSnapshot as unknown as Prisma.InputJsonValue,
        generatedById: actor.id,
      },
    });
  });

  await logActivity({
    entityType: "marketing_strategy",
    entityId: updated.id,
    action: "strategy_edited",
    actor,
    metadata: { campaignId, previousVersion: strategy.version, newVersion: updated.version },
  });

  return updated;
}

// Approves a draft strategy in place (no new version) and archives whatever
// other version currently holds "approved" for this campaign, atomically.
// Approved content is then immutable — see MarketingStrategyNotEditableError
// in editMarketingStrategy(), which this same status check also protects
// against re-approval or approving an archived version.
export async function approveMarketingStrategy(
  campaignId: string,
  strategyId: string,
  actor: Actor,
) {
  const strategy = await prisma.marketingStrategy.findUnique({ where: { id: strategyId } });
  if (!strategy || strategy.campaignId !== campaignId) {
    throw new MarketingStrategyNotFoundError(campaignId);
  }

  if (strategy.status !== MarketingStrategyStatus.draft) {
    throw new MarketingStrategyNotEditableError(strategyId, strategy.status);
  }

  const parsedContent = marketingStrategyOutputSchema.safeParse(strategy.content);
  if (!parsedContent.success) {
    throw new MarketingStrategyContentInvalidError(strategyId);
  }

  const approved = await prisma.$transaction(async (tx) => {
    await tx.marketingStrategy.updateMany({
      where: { campaignId, status: MarketingStrategyStatus.approved },
      data: { status: MarketingStrategyStatus.archived },
    });

    return tx.marketingStrategy.update({
      where: { id: strategy.id },
      data: {
        status: MarketingStrategyStatus.approved,
        approvedById: actor.id,
        approvedAt: new Date(),
      },
    });
  });

  await logActivity({
    entityType: "marketing_strategy",
    entityId: approved.id,
    action: "strategy_approved",
    actor,
    metadata: { campaignId, version: approved.version },
  });

  return approved;
}

// The only interface Phase 2B is meant to call. Returns the approved
// version only — never a draft — so content generation can never
// accidentally run against unreviewed AI output. Pure read, no writes.
export async function getApprovedMarketingStrategy(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) throw new CampaignNotFoundError(campaignId);

  const strategy = await prisma.marketingStrategy.findFirst({
    where: { campaignId, status: MarketingStrategyStatus.approved },
  });
  if (!strategy) throw new MarketingStrategyNotApprovedError(campaignId);

  return strategy;
}
