import { prisma } from "@/server/db/client";
import { logActivity, type Actor } from "@/lib/actor";
import { CampaignNotFoundError } from "@/server/services/campaign-service";
import type {
  AcquisitionClickInput,
  AcquisitionTrackQueryInput,
} from "@/server/validation/acquisition-schema";

// This endpoint is deliberately unauthenticated (a future customer clicking
// a live ad, not a staff action), so there is no human actor to attribute
// this to. Every AcquisitionEvent is logged as a system-observed event,
// matching the existing convention (e.g. launch_succeeded/launch_failed in
// launch-service.ts) rather than inventing a new actor category.
const SYSTEM_ACTOR: Actor = { type: "system", id: null };

// Thrown when a supplied datasetId/launchId does not actually belong to
// the campaign the click is attributed to — attribution is validated, never
// guessed or silently dropped. See recordAcquisitionEvent().
export class InvalidAcquisitionAttributionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAcquisitionAttributionError";
  }
}

export class LaunchNotFoundError extends Error {
  constructor(launchId: string) {
    super(`Launch ${launchId} not found.`);
    this.name = "LaunchNotFoundError";
  }
}

async function assertDatasetTargetedByCampaign(campaignId: string, datasetId: string): Promise<void> {
  const campaignDataset = await prisma.campaignDataset.findUnique({
    where: { campaignId_datasetId: { campaignId, datasetId } },
  });
  if (!campaignDataset) {
    throw new InvalidAcquisitionAttributionError(
      `Dataset ${datasetId} is not targeted by campaign ${campaignId}.`,
    );
  }
}

async function createAndLogAcquisitionEvent(data: {
  campaignId: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  ref: string | null;
  datasetId: string | null;
  launchId: string | null;
  attributionSource: "manual" | "launch_tracking_link";
}) {
  const event = await prisma.acquisitionEvent.create({
    data: {
      campaignId: data.campaignId,
      source: data.source,
      medium: data.medium,
      campaign: data.campaign,
      ref: data.ref,
      datasetId: data.datasetId,
      launchId: data.launchId,
    },
  });

  await logActivity({
    entityType: "acquisition_event",
    entityId: event.id,
    action: "acquisition_event_recorded",
    actor: SYSTEM_ACTOR,
    metadata: {
      campaignId: data.campaignId,
      source: data.source,
      medium: data.medium,
      campaign: data.campaign,
      ref: data.ref,
      datasetId: data.datasetId,
      launchId: data.launchId,
      // Distinguishes a click whose attribution was deterministically
      // derived from a Launch's own tracking link (reliable — see
      // recordAcquisitionEventFromLaunch()) from one where campaignId/
      // datasetId/launchId were supplied manually in a raw POST body and
      // only verified after the fact (recordAcquisitionEvent()).
      attributionSource: data.attributionSource,
    },
  });

  return event;
}

// Records where an incoming customer click originated from. campaignId is
// the sole authoritative campaign attribution — source/medium/campaign/ref
// are persisted exactly as received, never merged, inferred, or used to
// override anything. Never creates or modifies a Campaign, Lead, or
// WhatsApp record — this is purely an attribution log entry, read-only
// against everything in Phase 1/2.
//
// Stage 10 (Phase 4 final): datasetId/launchId are optional dataset/
// creative attribution. When supplied, each is verified to genuinely
// belong to this campaign (datasetId must be one of the campaign's
// targeted datasets via CampaignDataset; launchId must be a Launch row
// whose own campaignId matches) before being persisted — a click can
// never be attributed to another campaign's dataset or creative.
export async function recordAcquisitionEvent(input: AcquisitionClickInput) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    select: { id: true },
  });
  if (!campaign) throw new CampaignNotFoundError(input.campaignId);

  if (input.datasetId) {
    await assertDatasetTargetedByCampaign(input.campaignId, input.datasetId);
  }

  if (input.launchId) {
    const launch = await prisma.launch.findUnique({
      where: { id: input.launchId },
      select: { campaignId: true },
    });
    if (!launch || launch.campaignId !== input.campaignId) {
      throw new InvalidAcquisitionAttributionError(
        `Launch ${input.launchId} does not belong to campaign ${input.campaignId}.`,
      );
    }
  }

  return createAndLogAcquisitionEvent({
    campaignId: input.campaignId,
    source: input.source ?? null,
    medium: input.medium ?? null,
    campaign: input.campaign ?? null,
    ref: input.ref ?? null,
    datasetId: input.datasetId ?? null,
    launchId: input.launchId ?? null,
    attributionSource: "manual",
  });
}

// Reliable click attribution (Phase 4 final gap-closure): the deterministic
// tracking identity for a generated launch tracking link IS the Launch's
// own id (already a stable, unique identifier — see Launch's own doc
// comment for its full identity: campaignId + contentSetId +
// contentSetVersion + platform + variantIndex). campaignId is NEVER
// accepted from the caller here — it is derived exclusively from the
// looked-up Launch row, so a click through this path cannot be attributed
// to the wrong campaign even by a malformed/malicious request. datasetId
// stays optional and, when supplied, is still validated against the
// derived campaignId exactly like the manual path. No new "Creative"
// table — the tracking identity is the pre-existing Launch identity.
export async function recordAcquisitionEventFromLaunch(
  launchId: string,
  input: AcquisitionTrackQueryInput,
) {
  const launch = await prisma.launch.findUnique({
    where: { id: launchId },
    select: { id: true, campaignId: true },
  });
  if (!launch) throw new LaunchNotFoundError(launchId);

  if (input.datasetId) {
    await assertDatasetTargetedByCampaign(launch.campaignId, input.datasetId);
  }

  return createAndLogAcquisitionEvent({
    campaignId: launch.campaignId,
    source: input.source ?? null,
    medium: input.medium ?? null,
    campaign: input.campaign ?? null,
    ref: input.ref ?? null,
    datasetId: input.datasetId ?? null,
    launchId: launch.id,
    attributionSource: "launch_tracking_link",
  });
}
