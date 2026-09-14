import { ApplicationStatus, LeadStatus, type Lead } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { logActivity, type Actor } from "@/lib/actor";
import { LeadNotFoundError } from "@/server/services/conversation-service";

// Any valid ApplicationStatus transition is allowed, including moving
// backwards (e.g. correcting a mistaken "submitted") — mirrors Phase 3D's
// "do not artificially prevent downgrades" philosophy applied here to
// applicationStatus instead of LeadStatus. No gate on Lead.status: an
// agent can record application progress regardless of the Lead's current
// classification.
export async function updateApplicationStatus(
  leadId: string,
  applicationStatus: ApplicationStatus,
  actor: Actor,
): Promise<Lead> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new LeadNotFoundError(leadId);

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: { applicationStatus },
  });

  await logActivity({
    entityType: "lead",
    entityId: leadId,
    action: "application_status_changed",
    actor,
    metadata: { from: lead.applicationStatus, to: applicationStatus },
  });

  return updated;
}

// Qualified Lead is a computed business outcome, not a stored status —
// there is no "qualified" value in LeadStatus or ApplicationStatus
// anywhere in the schema.
export function isQualifiedLead(lead: Pick<Lead, "status" | "applicationStatus">): boolean {
  return lead.status === LeadStatus.hot && lead.applicationStatus === ApplicationStatus.submitted;
}
