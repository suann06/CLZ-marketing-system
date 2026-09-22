import { ApplicationStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { LeadNotFoundError } from "@/server/services/conversation-service";

// Read-only UI-facing queries — deliberately a separate file from the
// frozen lead-service.ts (Phase 3B) rather than adding to it, so that file
// stays at zero diff. No writes anywhere in this file; LeadNotFoundError is
// reused by import, matching the established project-wide convention
// (conversation-service.ts, lead-classification-service.ts,
// handover-service.ts, application-service.ts, sale-service.ts all do the
// same rather than redefining it).

export async function listLeadsForCampaign(campaignId: string) {
  return prisma.lead.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
  });
}

// Phase 4D: cross-campaign Leads list. Every filter (search/status/
// application status/campaign) is applied client-side in lead-list-view.tsx
// over this one fetch — same "load once, filter in the browser" pattern
// campaigns/page.tsx and the Phase 4C building-select-step already use —
// so this stays a single, simple, unfiltered query rather than a
// query-per-filter-combination.
export async function listAllLeads() {
  return prisma.lead.findMany({
    orderBy: { updatedAt: "desc" },
    include: { campaign: { select: { id: true, name: true } } },
  });
}

// Phase 4D Applications: NOT a new entity — the approved proposal defines
// "Applications" as exactly this: existing Lead rows whose
// applicationStatus has left its default. No new table, no new write path.
export async function listApplications() {
  return prisma.lead.findMany({
    where: { applicationStatus: { not: ApplicationStatus.not_started } },
    orderBy: { updatedAt: "desc" },
    include: { campaign: { select: { id: true, name: true } } },
  });
}

// Phase 4D Sales: existing Sale rows, joined with their Lead (customer
// phone/name) and Campaign (name) purely for display — sale-service.ts
// remains the only writer.
export async function listSales() {
  return prisma.sale.findMany({
    orderBy: { closedAt: "desc" },
    include: {
      lead: { select: { id: true, phone: true, name: true } },
      campaign: { select: { id: true, name: true } },
    },
  });
}

// Phase 6: campaign-scoped Sales — the same listSales() query, filtered by
// campaignId, for the new "Sales" workspace tab (approved Dark Olive Luxury
// IA). Mirrors listLeadsForCampaign()'s relationship to listAllLeads()
// above; sale-service.ts remains the only writer.
export async function listSalesForCampaign(campaignId: string) {
  return prisma.sale.findMany({
    where: { campaignId },
    orderBy: { closedAt: "desc" },
    include: {
      lead: { select: { id: true, phone: true, name: true } },
      campaign: { select: { id: true, name: true } },
    },
  });
}

// Phase 4D: extended with campaign/statusHistory/followUps/activity —
// purely additive reads for the redesigned Lead detail workspace (existing
// callers destructuring {lead, thread, messages, sale} are unaffected).
// activity covers both this Lead's own ActivityLog rows (entityType
// "lead") and, when it has follow-ups or a sale, the ActivityLog rows
// logged against those (entityType "follow_up" / "sale") — every one of
// them already written by follow-up-service.ts / sale-service.ts, nothing
// new is logged here.
export async function getLeadDetail(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { campaign: { select: { id: true, name: true } } },
  });
  if (!lead) throw new LeadNotFoundError(leadId);

  const [thread, messages, sale, statusHistory, followUps] = await Promise.all([
    prisma.whatsAppThread.findFirst({ where: { leadId } }),
    prisma.whatsAppMessage.findMany({ where: { leadId }, orderBy: { createdAt: "asc" } }),
    prisma.sale.findUnique({ where: { leadId } }),
    prisma.leadStatusHistory.findMany({ where: { leadId }, orderBy: { createdAt: "desc" } }),
    prisma.followUp.findMany({ where: { leadId }, orderBy: { day: "asc" } }),
  ]);

  const activityOr: Prisma.ActivityLogWhereInput[] = [{ entityType: "lead", entityId: leadId }];
  if (followUps.length > 0) {
    activityOr.push({ entityType: "follow_up", entityId: { in: followUps.map((f) => f.id) } });
  }
  if (sale) {
    activityOr.push({ entityType: "sale", entityId: sale.id });
  }
  const activity = await prisma.activityLog.findMany({
    where: { OR: activityOr },
    orderBy: { createdAt: "desc" },
  });

  return { lead, thread, messages, sale, statusHistory, followUps, activity };
}
