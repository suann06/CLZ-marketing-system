import { Prisma, WhatsAppMessageDirection, type LeadStatus } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { logActivity, type Actor } from "@/lib/actor";
import { getAiProvider } from "@/server/providers/ai/provider-registry";
import { leadClassificationOutputSchema } from "@/server/validation/lead-classification-schema";
import type { AiConversationMessage, AiCustomerInfo } from "@/server/providers/ai/provider-adapter";
import { LeadNotFoundError, ThreadNotFoundError, ThreadLeadMismatchError } from "@/server/services/conversation-service";

const AI_ACTOR: Actor = { type: "ai", id: null };

// Same window as conversation-service.ts's RECENT_MESSAGE_LIMIT — the
// classifier sees controlled, recent context, not the entire thread
// history.
const RECENT_MESSAGE_LIMIT = 20;

const CUSTOMER_INFO_FIELDS = ["name", "location", "currentProvider", "interest"] as const;

// Below this trimmed length, an inbound message is treated as too thin to
// carry qualification signal (e.g. "Hi"). A Lead with only such messages
// is left as "new" — the AI is never even called, since there is nothing
// meaningful yet for it to classify. This is a deliberately simple,
// documented, testable heuristic — not an attempt at real NLU.
const MIN_SIGNAL_LENGTH = 6;

// Thrown for any AI provider failure OR a structurally invalid
// classification response (see lead-classification-schema.ts) — the
// classification service never applies an unvalidated proposal.
export class LeadClassificationAiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadClassificationAiError";
  }
}

function normalizeCustomerInfo(value: Prisma.JsonValue): AiCustomerInfo {
  const source =
    value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const result: AiCustomerInfo = {};
  for (const field of CUSTOMER_INFO_FIELDS) {
    const v = source[field];
    result[field] = typeof v === "string" ? v : null;
  }
  return result;
}

function hasSufficientSignal(inboundMessages: { content: string }[]): boolean {
  return inboundMessages.some((m) => m.content.trim().length >= MIN_SIGNAL_LENGTH);
}

export type ClassifyLeadInput = {
  leadId: string;
  threadId: string;
};

// Loads the Lead/Thread/Campaign/recent conversation, asks the AI provider
// to propose a hot/warm/cold classification, validates the proposal, and
// — this service, never the AI provider — decides whether to apply it:
//
//  - Insufficient signal (see hasSufficientSignal()): the AI is not even
//    called; the Lead's current status is returned unchanged and no
//    LeadStatusHistory row is created. This is how a bare "Hi" stays
//    "new" rather than being forced to "cold".
//  - Proposed status === current status: no-op. No LeadStatusHistory row
//    is created for a same-status "change" (e.g. warm -> warm).
//  - Proposed status !== current status: Lead.status is updated and
//    exactly one LeadStatusHistory row is created (fromStatus = the prior
//    status, toStatus = the new one, reason = the AI's stated reason,
//    actorType = "ai"). Downgrades (e.g. hot -> cold) are allowed — intent
//    can change over time, and this service does not prevent them.
//
// Scoped strictly to the given Lead/Thread/Campaign — never mixes in
// another Lead's or campaign's conversation, since every query below is
// filtered by the loaded Lead's own campaignId / the loaded Thread's own
// id.
export async function classifyLead(input: ClassifyLeadInput) {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) throw new LeadNotFoundError(input.leadId);

  const thread = await prisma.whatsAppThread.findUnique({ where: { id: input.threadId } });
  if (!thread) throw new ThreadNotFoundError(input.threadId);
  if (thread.leadId !== lead.id) throw new ThreadLeadMismatchError(input.threadId, input.leadId);

  const campaign = await prisma.campaign.findUnique({
    where: { id: lead.campaignId },
    select: { productPromotion: true, officialPricing: true, differentiators: true },
  });
  if (!campaign) throw new LeadNotFoundError(input.leadId);

  const recentDesc = await prisma.whatsAppMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "desc" },
    take: RECENT_MESSAGE_LIMIT,
  });
  const recentMessages: AiConversationMessage[] = [...recentDesc]
    .reverse()
    .map((m) => ({ direction: m.direction, content: m.content, createdAt: m.createdAt }));

  const inboundMessages = recentDesc.filter((m) => m.direction === WhatsAppMessageDirection.inbound);

  if (!hasSufficientSignal(inboundMessages)) {
    return {
      classified: false as const,
      status: lead.status,
      previousStatus: lead.status,
      changed: false as const,
      lead,
    };
  }

  const provider = getAiProvider();

  let rawResult: unknown;
  try {
    rawResult = await provider.classifyLead({
      campaign: {
        productPromotion: campaign.productPromotion,
        officialPricing: campaign.officialPricing,
        differentiators: campaign.differentiators,
      },
      customerInfo: normalizeCustomerInfo(lead.customerInfo),
      recentMessages,
    });
  } catch (err) {
    throw new LeadClassificationAiError(
      err instanceof Error ? err.message : "Unknown AI provider error.",
    );
  }

  const parsed = leadClassificationOutputSchema.safeParse(rawResult);
  if (!parsed.success) {
    throw new LeadClassificationAiError(
      `AI classification response failed validation: ${parsed.error.message}`,
    );
  }
  const { classification, reason } = parsed.data;
  const proposedStatus: LeadStatus = classification;

  if (proposedStatus === lead.status) {
    await logActivity({
      entityType: "lead",
      entityId: lead.id,
      action: "lead_classified",
      actor: AI_ACTOR,
      metadata: { proposedStatus, previousStatus: lead.status, changed: false, threadId: thread.id },
    });

    return {
      classified: true as const,
      status: lead.status,
      previousStatus: lead.status,
      changed: false as const,
      reason,
      lead,
    };
  }

  const previousStatus = lead.status;
  const updatedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: { status: proposedStatus },
  });

  await prisma.leadStatusHistory.create({
    data: {
      leadId: lead.id,
      fromStatus: previousStatus,
      toStatus: proposedStatus,
      reason,
      actorType: AI_ACTOR.type,
      actorId: AI_ACTOR.id,
    },
  });

  await logActivity({
    entityType: "lead",
    entityId: lead.id,
    action: "lead_classified",
    actor: AI_ACTOR,
    metadata: { proposedStatus, previousStatus, changed: true, threadId: thread.id },
  });

  await logActivity({
    entityType: "lead",
    entityId: lead.id,
    action: "lead_status_changed",
    actor: AI_ACTOR,
    metadata: { fromStatus: previousStatus, toStatus: proposedStatus, reason },
  });

  return {
    classified: true as const,
    status: proposedStatus,
    previousStatus,
    changed: true as const,
    reason,
    lead: updatedLead,
  };
}
