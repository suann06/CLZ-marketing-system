import { Prisma, SaleStatus, type Sale } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { logActivity, type Actor } from "@/lib/actor";
import { LeadNotFoundError } from "@/server/services/conversation-service";
import type { SaleOutcomeInput } from "@/server/validation/sale-schema";

export class ApplicationNotSubmittedError extends Error {
  constructor(leadId: string) {
    super(`Lead ${leadId}'s application must be "submitted" before a sale outcome can be recorded.`);
    this.name = "ApplicationNotSubmittedError";
  }
}

export class SaleAlreadyRecordedError extends Error {
  constructor(leadId: string) {
    super(`Lead ${leadId} already has a recorded sale outcome.`);
    this.name = "SaleAlreadyRecordedError";
  }
}

export class SaleNotFoundError extends Error {
  constructor(leadId: string) {
    super(`Lead ${leadId} has no recorded sale outcome to update.`);
    this.name = "SaleNotFoundError";
  }
}

function toSaleData(input: SaleOutcomeInput) {
  if (input.status === "won") {
    return {
      status: SaleStatus.won,
      saleValue: new Prisma.Decimal(input.saleValue),
      lostReason: null,
    };
  }
  return {
    status: SaleStatus.lost,
    saleValue: null,
    lostReason: input.lostReason,
  };
}

// Records the final sales outcome for a Lead. Requires a human actor
// (never AI/system) — Sale is exclusively human-recorded. campaignId is
// always derived from the loaded Lead, never accepted from the caller.
// One Sale per Lead: a second call for a Lead that already has one throws
// SaleAlreadyRecordedError rather than overwriting — corrections go
// through updateSaleOutcome() instead, an explicit, separate action.
export async function recordSaleOutcome(
  leadId: string,
  input: SaleOutcomeInput,
  actor: Actor,
): Promise<Sale> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new LeadNotFoundError(leadId);
  if (lead.applicationStatus !== "submitted") throw new ApplicationNotSubmittedError(leadId);

  const existing = await prisma.sale.findUnique({ where: { leadId } });
  if (existing) throw new SaleAlreadyRecordedError(leadId);

  const data = toSaleData(input);
  const closedAt = new Date();

  const sale = await prisma.sale.create({
    data: {
      leadId,
      campaignId: lead.campaignId,
      ...data,
      closedAt,
    },
  });

  await logActivity({
    entityType: "sale",
    entityId: sale.id,
    action: "sale_recorded",
    actor,
    metadata: {
      leadId,
      campaignId: lead.campaignId,
      status: data.status,
      saleValue: input.status === "won" ? input.saleValue : null,
    },
  });

  return sale;
}

// Corrects an existing Sale (e.g. won -> lost, or a value/reason
// correction). Same application-submitted precondition as recordSaleOutcome
// — a correction is still gated on the Lead's application state, matching
// the create path. closedAt is deliberately preserved from the original
// row, never re-stamped — the sale's original close date is a fact that
// shouldn't shift just because a later detail was corrected.
export async function updateSaleOutcome(
  leadId: string,
  input: SaleOutcomeInput,
  actor: Actor,
): Promise<Sale> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new LeadNotFoundError(leadId);
  if (lead.applicationStatus !== "submitted") throw new ApplicationNotSubmittedError(leadId);

  const existing = await prisma.sale.findUnique({ where: { leadId } });
  if (!existing) throw new SaleNotFoundError(leadId);

  const data = toSaleData(input);

  const updated = await prisma.sale.update({
    where: { leadId },
    data,
  });

  await logActivity({
    entityType: "sale",
    entityId: updated.id,
    action: "sale_updated",
    actor,
    metadata: {
      leadId,
      campaignId: lead.campaignId,
      before: {
        status: existing.status,
        saleValue: existing.saleValue,
        lostReason: existing.lostReason,
      },
      after: {
        status: updated.status,
        saleValue: updated.saleValue,
        lostReason: updated.lostReason,
      },
    },
  });

  return updated;
}
