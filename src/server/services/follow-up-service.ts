import { FollowUpStatus, LeadStatus, WhatsAppMessageDirection, type FollowUp } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { logActivity, type Actor } from "@/lib/actor";
import { getWhatsAppProvider } from "@/server/providers/whatsapp/provider-registry";
import { buildFollowUpMessage } from "@/server/services/follow-up-message-builder";
import { LeadNotFoundError } from "@/server/services/conversation-service";

// Every action here is system-automated (triggered by classification or a
// scheduler), never a direct human action — matches lead-service.ts /
// whatsapp-service.ts / conversation-service.ts, none of which accept an
// actor parameter either.
const SYSTEM_ACTOR: Actor = { type: "system", id: null };

export const FOLLOW_UP_DAYS = [1, 3, 7] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

// Idempotent: if the Lead already has any non-cancelled FollowUp row
// (pending, sent, or failed), a journey has already been entered and
// nothing new is created — this is what prevents duplicate Day 1/3/7 rows
// when a Lead re-enters warm/cold repeatedly. A future "new cycle" concept
// (e.g. after a fully-resolved journey and a long gap) is an explicit,
// separate design decision, not built here — see the Phase 3E report.
export async function scheduleFollowUpJourney(leadId: string): Promise<FollowUp[]> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) throw new LeadNotFoundError(leadId);

  const existingActive = await prisma.followUp.findMany({
    where: { leadId, status: { not: FollowUpStatus.cancelled } },
  });
  if (existingActive.length > 0) {
    return existingActive;
  }

  const enteredAt = new Date();
  const created: FollowUp[] = [];
  for (const day of FOLLOW_UP_DAYS) {
    const followUp = await prisma.followUp.create({
      data: { leadId, day, scheduledAt: new Date(enteredAt.getTime() + day * DAY_MS) },
    });
    created.push(followUp);
  }

  await logActivity({
    entityType: "lead",
    entityId: leadId,
    action: "follow_up_created",
    actor: SYSTEM_ACTOR,
    metadata: { days: FOLLOW_UP_DAYS, followUpIds: created.map((f) => f.id) },
  });

  return created;
}

// Only cancels rows that are still untouched (pending, not yet claimed by
// a concurrent processDueFollowUps() call) — a row already claimed is left
// for that in-flight call to resolve to its real outcome, avoiding a
// cancel/send race.
export async function cancelPendingFollowUps(leadId: string, reason: string): Promise<FollowUp[]> {
  const cancellable = await prisma.followUp.findMany({
    where: { leadId, status: FollowUpStatus.pending, claimedAt: null },
  });
  if (cancellable.length === 0) return [];

  await prisma.followUp.updateMany({
    where: { id: { in: cancellable.map((f) => f.id) } },
    data: { status: FollowUpStatus.cancelled },
  });

  await logActivity({
    entityType: "lead",
    entityId: leadId,
    action: "follow_up_cancelled",
    actor: SYSTEM_ACTOR,
    metadata: { followUpIds: cancellable.map((f) => f.id), reason },
  });

  return cancellable.map((f) => ({ ...f, status: FollowUpStatus.cancelled }));
}

export type ProcessFollowUpOutcome = "skipped" | "cancelled" | "sent" | "failed";

export type ProcessFollowUpResult = {
  id: string;
  outcome: ProcessFollowUpOutcome;
  followUp?: FollowUp;
};

// Claims a due, pending, unclaimed row via an atomic conditional UPDATE
// (`WHERE status = 'pending' AND claimed_at IS NULL`) BEFORE doing
// anything else. Postgres guarantees only one concurrent caller can
// succeed at flipping claimedAt from null on a given row; a second,
// near-simultaneous call sees `count: 0` and skips it entirely — this is
// how Scenario B (concurrent processing attempts) is handled without an
// in-flight status value. `status` itself is only ever written once the
// real outcome is known: "sent" is set only after the WhatsApp provider
// call actually succeeds, never before.
async function processSingleFollowUp(followUp: FollowUp, now: Date): Promise<ProcessFollowUpResult> {
  const claim = await prisma.followUp.updateMany({
    where: { id: followUp.id, status: FollowUpStatus.pending, claimedAt: null },
    data: { claimedAt: now },
  });
  if (claim.count === 0) {
    return { id: followUp.id, outcome: "skipped" };
  }

  const lead = await prisma.lead.findUnique({ where: { id: followUp.leadId } });
  if (!lead) {
    const failed = await prisma.followUp.update({
      where: { id: followUp.id },
      data: { status: FollowUpStatus.failed, failureReason: "Lead not found." },
    });
    return { id: followUp.id, outcome: "failed", followUp: failed };
  }

  // HOT: the customer already moved to the handover path — cancel rather
  // than send a generic nurture message. No WhatsApp message is sent.
  if (lead.status === LeadStatus.hot) {
    const cancelled = await prisma.followUp.update({
      where: { id: followUp.id },
      data: { status: FollowUpStatus.cancelled },
    });

    await logActivity({
      entityType: "follow_up",
      entityId: followUp.id,
      action: "follow_up_cancelled",
      actor: SYSTEM_ACTOR,
      metadata: { leadId: lead.id, reason: "Lead is hot." },
    });

    return { id: followUp.id, outcome: "cancelled", followUp: cancelled };
  }

  const thread = await prisma.whatsAppThread.findFirst({ where: { leadId: lead.id } });
  if (!thread) {
    const failed = await prisma.followUp.update({
      where: { id: followUp.id },
      data: { status: FollowUpStatus.failed, failureReason: "No WhatsApp thread found for lead." },
    });

    await logActivity({
      entityType: "follow_up",
      entityId: followUp.id,
      action: "follow_up_send_failed",
      actor: SYSTEM_ACTOR,
      metadata: { leadId: lead.id, failureReason: failed.failureReason },
    });

    return { id: followUp.id, outcome: "failed", followUp: failed };
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: lead.campaignId },
    select: { productPromotion: true },
  });
  if (!campaign) {
    const failed = await prisma.followUp.update({
      where: { id: followUp.id },
      data: { status: FollowUpStatus.failed, failureReason: "Campaign not found." },
    });
    return { id: followUp.id, outcome: "failed", followUp: failed };
  }

  const content = buildFollowUpMessage(followUp.day, { name: lead.name }, campaign);

  // Persisted before the provider send is attempted — same
  // persist-before-external-call ordering as conversation-service.ts's
  // outbound message.
  const outboundMessage = await prisma.whatsAppMessage.create({
    data: {
      threadId: thread.id,
      leadId: lead.id,
      direction: WhatsAppMessageDirection.outbound,
      content,
      externalMessageId: null,
      metadata: { followUpId: followUp.id, day: followUp.day },
    },
  });

  const provider = getWhatsAppProvider();
  let sendResult;
  try {
    sendResult = await provider.send({ externalThreadId: thread.externalThreadId, content });
  } catch (err) {
    sendResult = {
      success: false as const,
      failureReason: err instanceof Error ? err.message : "Unknown WhatsApp provider error.",
    };
  }

  if (sendResult.success) {
    await prisma.whatsAppMessage.update({
      where: { id: outboundMessage.id },
      data: { externalMessageId: sendResult.externalMessageId },
    });

    const sent = await prisma.followUp.update({
      where: { id: followUp.id },
      data: { status: FollowUpStatus.sent, sentAt: new Date() },
    });

    await logActivity({
      entityType: "follow_up",
      entityId: followUp.id,
      action: "follow_up_sent",
      actor: SYSTEM_ACTOR,
      metadata: { leadId: lead.id, day: followUp.day, externalMessageId: sendResult.externalMessageId },
    });

    return { id: followUp.id, outcome: "sent", followUp: sent };
  }

  const failed = await prisma.followUp.update({
    where: { id: followUp.id },
    data: { status: FollowUpStatus.failed, failureReason: sendResult.failureReason },
  });

  await logActivity({
    entityType: "follow_up",
    entityId: followUp.id,
    action: "follow_up_send_failed",
    actor: SYSTEM_ACTOR,
    metadata: { leadId: lead.id, day: followUp.day, failureReason: sendResult.failureReason },
  });

  return { id: followUp.id, outcome: "failed", followUp: failed };
}

// Entry point for a future scheduler. Finds pending, unclaimed, due rows
// and processes each in turn — see processSingleFollowUp() for the
// per-row claim/outcome logic. Safe to call repeatedly/concurrently: an
// already-resolved or already-claimed row is simply skipped.
export async function processDueFollowUps(now: Date = new Date()): Promise<ProcessFollowUpResult[]> {
  const due = await prisma.followUp.findMany({
    where: { status: FollowUpStatus.pending, claimedAt: null, scheduledAt: { lte: now } },
  });

  const results: ProcessFollowUpResult[] = [];
  for (const followUp of due) {
    results.push(await processSingleFollowUp(followUp, now));
  }
  return results;
}
