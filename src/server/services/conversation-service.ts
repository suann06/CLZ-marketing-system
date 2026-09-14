import { Prisma, WhatsAppMessageDirection } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { logActivity, type Actor } from "@/lib/actor";
import { getAiProvider } from "@/server/providers/ai/provider-registry";
import { getWhatsAppProvider } from "@/server/providers/whatsapp/provider-registry";
import { aiConversationOutputSchema } from "@/server/validation/ai-conversation-schema";
import type { AiConversationMessage, AiCustomerInfo } from "@/server/providers/ai/provider-adapter";

const SYSTEM_ACTOR: Actor = { type: "system", id: null };
const AI_ACTOR: Actor = { type: "ai", id: null };

// How much prior conversation the AI is shown. A fixed, small window — not
// unlimited history — keeps the context controlled per Phase 3C's "AI
// receives controlled context, not the entire database" requirement.
const RECENT_MESSAGE_LIMIT = 20;

const CUSTOMER_INFO_FIELDS = ["name", "location", "currentProvider", "interest"] as const;

export class LeadNotFoundError extends Error {
  constructor(leadId: string) {
    super(`Lead ${leadId} not found.`);
    this.name = "LeadNotFoundError";
  }
}

export class ThreadNotFoundError extends Error {
  constructor(threadId: string) {
    super(`WhatsApp thread ${threadId} not found.`);
    this.name = "ThreadNotFoundError";
  }
}

export class ThreadLeadMismatchError extends Error {
  constructor(threadId: string, leadId: string) {
    super(`WhatsApp thread ${threadId} does not belong to lead ${leadId}.`);
    this.name = "ThreadLeadMismatchError";
  }
}

export class NoInboundMessageError extends Error {
  constructor(threadId: string) {
    super(`No inbound message found on thread ${threadId} to respond to.`);
    this.name = "NoInboundMessageError";
  }
}

// Thrown for any AI provider failure OR a structurally invalid AI response
// (see ai-conversation-schema.ts) — both are "AI processing failed" from
// the caller's point of view. Never thrown after the outbound message has
// been persisted; see processInboundMessage()'s ordering.
export class ConversationAiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversationAiError";
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

// New non-null values are written; null/undefined values from the AI are
// never allowed to overwrite a previously known value. This is the only
// place Lead.customerInfo is merged in Phase 3C — no field outside
// CUSTOMER_INFO_FIELDS is ever touched, so any other key already present
// on the JSON blob (from a future phase) survives untouched too.
function mergeCustomerInfo(
  existing: Prisma.JsonValue,
  incoming: AiCustomerInfo,
): Record<string, unknown> {
  const existingObj =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};

  for (const field of CUSTOMER_INFO_FIELDS) {
    const value = incoming[field];
    if (value !== null && value !== undefined) {
      existingObj[field] = value;
    }
  }

  return existingObj;
}

export type ProcessInboundMessageInput = {
  leadId: string;
  threadId: string;
};

// Orchestrates the Phase 3C conversation turn: load Lead/Thread/recent
// messages/campaign context -> call the AI provider -> validate its output
// -> merge extracted customer info into Lead.customerInfo -> persist the
// outbound WhatsAppMessage -> attempt to send it via the WhatsApp provider.
//
// Error handling (see AGENTS spec ??9):
//  - If the AI call fails, or its response fails schema validation, this
//    throws ConversationAiError BEFORE touching Lead.customerInfo or
//    creating any WhatsAppMessage row. The inbound message that triggered
//    this call (already persisted by whatsapp-service.ts before this
//    function ever runs) is untouched, and Lead.status is never touched
//    here at all (Phase 3C never writes LeadStatus).
//  - Once the AI response is validated, the outbound message is persisted
//    BEFORE the WhatsApp provider send is attempted. If the provider call
//    fails, the outbound row is kept as-is (not deleted, not marked
//    delivered) and the failure is surfaced via the returned
//    `delivered: false` result rather than thrown — a provider failure is
//    not an application error, it's an expected/reportable outcome.
export async function processInboundMessage(input: ProcessInboundMessageInput) {
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

  // Scoped strictly to this thread — never another Lead/campaign/thread's
  // messages.
  const recentDesc = await prisma.whatsAppMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "desc" },
    take: RECENT_MESSAGE_LIMIT,
  });
  const recentMessages: AiConversationMessage[] = [...recentDesc]
    .reverse()
    .map((m) => ({ direction: m.direction, content: m.content, createdAt: m.createdAt }));

  const latestInbound = recentDesc.find((m) => m.direction === WhatsAppMessageDirection.inbound);
  if (!latestInbound) throw new NoInboundMessageError(thread.id);

  const provider = getAiProvider();

  let rawResult: unknown;
  try {
    rawResult = await provider.converse({
      campaign: {
        productPromotion: campaign.productPromotion,
        officialPricing: campaign.officialPricing,
        differentiators: campaign.differentiators,
      },
      customerInfo: normalizeCustomerInfo(lead.customerInfo),
      recentMessages,
      currentMessage: latestInbound.content,
    });
  } catch (err) {
    throw new ConversationAiError(
      err instanceof Error ? err.message : "Unknown AI provider error.",
    );
  }

  const parsed = aiConversationOutputSchema.safeParse(rawResult);
  if (!parsed.success) {
    throw new ConversationAiError(`AI response failed validation: ${parsed.error.message}`);
  }
  const aiOutput = parsed.data;

  const mergedCustomerInfo = mergeCustomerInfo(lead.customerInfo, aiOutput.customerInfo);
  const updatedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: { customerInfo: mergedCustomerInfo as unknown as Prisma.InputJsonValue },
  });

  await logActivity({
    entityType: "lead",
    entityId: lead.id,
    action: "lead_customer_info_updated",
    actor: AI_ACTOR,
    metadata: { threadId: thread.id },
  });

  const outboundMessage = await prisma.whatsAppMessage.create({
    data: {
      threadId: thread.id,
      leadId: lead.id,
      direction: WhatsAppMessageDirection.outbound,
      content: aiOutput.response,
      externalMessageId: null,
      metadata: {},
    },
  });

  await logActivity({
    entityType: "whatsapp_message",
    entityId: outboundMessage.id,
    action: "ai_response_generated",
    actor: AI_ACTOR,
    metadata: { leadId: lead.id, threadId: thread.id },
  });

  const whatsAppProvider = getWhatsAppProvider();
  let sendResult;
  try {
    sendResult = await whatsAppProvider.send({
      externalThreadId: thread.externalThreadId,
      content: aiOutput.response,
    });
  } catch (err) {
    sendResult = {
      success: false as const,
      failureReason: err instanceof Error ? err.message : "Unknown WhatsApp provider error.",
    };
  }

  if (sendResult.success) {
    const sentMessage = await prisma.whatsAppMessage.update({
      where: { id: outboundMessage.id },
      data: { externalMessageId: sendResult.externalMessageId },
    });

    await logActivity({
      entityType: "whatsapp_message",
      entityId: sentMessage.id,
      action: "whatsapp_message_sent",
      actor: SYSTEM_ACTOR,
      metadata: { leadId: lead.id, threadId: thread.id, externalMessageId: sendResult.externalMessageId },
    });

    return { delivered: true, lead: updatedLead, thread, outboundMessage: sentMessage };
  }

  await logActivity({
    entityType: "whatsapp_message",
    entityId: outboundMessage.id,
    action: "whatsapp_message_send_failed",
    actor: SYSTEM_ACTOR,
    metadata: { leadId: lead.id, threadId: thread.id, failureReason: sendResult.failureReason },
  });

  return {
    delivered: false,
    failureReason: sendResult.failureReason,
    lead: updatedLead,
    thread,
    outboundMessage,
  };
}
