import { prisma } from "@/server/db/client";
import { logActivity, type Actor } from "@/lib/actor";
import { CampaignNotFoundError } from "@/server/services/campaign-service";
import type { AcquisitionClickInput } from "@/server/validation/acquisition-schema";

// This endpoint is deliberately unauthenticated (a future customer clicking
// a live ad, not a staff action), so there is no human actor to attribute
// this to. Every AcquisitionEvent is logged as a system-observed event,
// matching the existing convention (e.g. launch_succeeded/launch_failed in
// launch-service.ts) rather than inventing a new actor category.
const SYSTEM_ACTOR: Actor = { type: "system", id: null };

// Records where an incoming customer click originated from. campaignId is
// the sole authoritative campaign attribution — source/medium/campaign/ref
// are persisted exactly as received, never merged, inferred, or used to
// override anything. Never creates or modifies a Campaign, Lead, or
// WhatsApp record — this is purely an attribution log entry, read-only
// against everything in Phase 1/2.
export async function recordAcquisitionEvent(input: AcquisitionClickInput) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    select: { id: true },
  });
  if (!campaign) throw new CampaignNotFoundError(input.campaignId);

  const event = await prisma.acquisitionEvent.create({
    data: {
      campaignId: input.campaignId,
      source: input.source ?? null,
      medium: input.medium ?? null,
      campaign: input.campaign ?? null,
      ref: input.ref ?? null,
    },
  });

  await logActivity({
    entityType: "acquisition_event",
    entityId: event.id,
    action: "acquisition_event_recorded",
    actor: SYSTEM_ACTOR,
    metadata: {
      campaignId: input.campaignId,
      source: input.source,
      medium: input.medium,
      campaign: input.campaign,
      ref: input.ref,
    },
  });

  return event;
}
