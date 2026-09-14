import { NextResponse } from "next/server";
import { whatsAppWebhookSchema } from "@/server/validation/whatsapp-webhook-schema";
import { findOrCreateLead } from "@/server/services/lead-service";
import { storeInboundMessage } from "@/server/services/whatsapp-service";
import { processInboundMessage, ConversationAiError } from "@/server/services/conversation-service";
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
      return NextResponse.json({ lead, thread, message, conversation }, { status: 201 });
    } catch (err) {
      if (err instanceof ConversationAiError) {
        // The inbound message above is already committed regardless of
        // this outcome — AI failure never deletes it. Surfaced as 502
        // (upstream AI processing failed), distinct from the 400/404
        // validation/attribution failures below.
        return NextResponse.json(
          { lead, thread, message, conversation: null, error: err.message },
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
