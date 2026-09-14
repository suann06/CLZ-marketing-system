import { NextResponse } from "next/server";
import { whatsAppWebhookSchema } from "@/server/validation/whatsapp-webhook-schema";
import { findOrCreateLead } from "@/server/services/lead-service";
import { storeInboundMessage } from "@/server/services/whatsapp-service";
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
// Data foundation only: identify/create the campaign-scoped Lead, then
// identify/create its WhatsAppThread, then store the inbound message. No
// AI reply, no outbound send, no classification.
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

    const { thread, message } = await storeInboundMessage({
      leadId: lead.id,
      provider: input.provider,
      externalThreadId: input.externalThreadId,
      content: input.message,
      externalMessageId: input.externalMessageId ?? null,
    });

    return NextResponse.json({ lead, thread, message }, { status: 201 });
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
