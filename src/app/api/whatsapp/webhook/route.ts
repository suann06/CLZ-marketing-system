import { NextResponse } from "next/server";
import { whatsAppWebhookSchema } from "@/server/validation/whatsapp-webhook-schema";
import { findOrCreateLead } from "@/server/services/lead-service";
import { storeInboundMessage } from "@/server/services/whatsapp-service";
import { processInboundMessage, ConversationAiError } from "@/server/services/conversation-service";
import { classifyLead } from "@/server/services/lead-classification-service";
import { scheduleFollowUpJourney, cancelPendingFollowUps } from "@/server/services/follow-up-service";
import { CampaignNotFoundError } from "@/server/services/campaign-service";

export const dynamic = "force-dynamic";

// Deliberately no auth gate (matches /api/acquisition/click) — this is a
// customer-facing inbound WhatsApp endpoint, not a staff operation, so
// requireHumanActorOrResponse() is never called here.
//
// campaignId is required and validated as the sole authoritative campaign
// attribution (see whatsapp-webhook-schema.ts). If it is missing the
// request is rejected with 400 rather than guessing at attribution from
// phone number or any heuristic — no Lead is created without it.
//
// Phase 3B behavior (find/create Lead -> find/create Thread -> store
// inbound message) is preserved exactly. Phase 3C adds one step after the
// inbound message is stored: hand off to conversation-service.ts for AI
// processing, but ONLY when the inbound message was newly created —
// isNewMessage: false means this delivery is a retry of an
// already-processed message (see whatsapp-service.ts), and must not
// trigger a second AI response.
//
// Phase 3D adds one further step after conversation processing succeeds:
// hand off to lead-classification-service.ts, which decides on its own
// (see hasSufficientSignal()) whether there's enough signal to propose a
// hot/warm/cold classification, and owns the actual Lead.status mutation.
// A classification failure never fails the whole webhook response — by
// this point the inbound message and the AI's conversational reply have
// already fully succeeded, so classification is treated as a best-effort
// refinement, not a hard requirement of receiving the message.
//
// Phase 3E adds one more step, only when classification actually changed
// the Lead's status: hand off to follow-up-service.ts, which owns
// Day 1/3/7 follow-up scheduling and cancellation. Deliberately NOT added
// inside lead-classification-service.ts itself (kept frozen, zero diff) —
// the webhook route is the established cross-phase integration seam, same
// as how 3C/3D were wired in above. A hot Lead has its pending follow-ups
// cancelled; a warm/cold Lead has its follow-up journey scheduled
// (idempotently — a no-op if one is already active). Like classification,
// this is best-effort and never fails the webhook response.
//
// The route stays thin: no Prisma calls here, no AI/WhatsApp-provider
// calls here — everything beyond validation is delegated to the service
// layer.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = whatsAppWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;

  try {
    const lead = await findOrCreateLead({
      campaignId: input.campaignId,
      phone: input.phone,
      acquisitionEventId: input.acquisitionEventId ?? null,
    });

    const { thread, message, isNewMessage } = await storeInboundMessage({
      leadId: lead.id,
      provider: input.provider,
      externalThreadId: input.externalThreadId,
      content: input.message,
      externalMessageId: input.externalMessageId ?? null,
    });

    if (!isNewMessage) {
      return NextResponse.json({ lead, thread, message, conversation: null }, { status: 201 });
    }

    try {
      const conversation = await processInboundMessage({ leadId: lead.id, threadId: thread.id });

      let classification: Awaited<ReturnType<typeof classifyLead>> | { error: string } | null = null;
      try {
        classification = await classifyLead({ leadId: lead.id, threadId: thread.id });
      } catch (err) {
        classification = { error: err instanceof Error ? err.message : "Unknown classification error." };
      }

      let followUp: unknown = null;
      if (classification && "changed" in classification && classification.changed) {
        try {
          if (classification.status === "hot") {
            followUp = await cancelPendingFollowUps(lead.id, "Lead became hot.");
          } else if (classification.status === "warm" || classification.status === "cold") {
            followUp = await scheduleFollowUpJourney(lead.id);
          }
        } catch (err) {
          followUp = { error: err instanceof Error ? err.message : "Unknown follow-up error." };
        }
      }

      return NextResponse.json({ lead, thread, message, conversation, classification, followUp }, { status: 201 });
    } catch (err) {
      if (err instanceof ConversationAiError) {
        // The inbound message above is already committed regardless of
        // this outcome — AI failure never deletes it. Surfaced as 502
        // (upstream AI processing failed), distinct from the 400/404
        // validation/attribution failures below.
        return NextResponse.json(
          { lead, thread, message, conversation: null, classification: null, error: err.message },
          { status: 502 },
        );
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
