import { LeadStatus } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { logActivity, type Actor } from "@/lib/actor";
import { LeadNotFoundError } from "@/server/services/conversation-service";

export class LeadNotHotError extends Error {
  constructor(leadId: string, status: LeadStatus) {
    super(`Lead ${leadId} is "${status}" — only a "hot" Lead can be handed over.`);
    this.name = "LeadNotHotError";
  }
}

// Human handover is only valid from hot — new/warm/cold are rejected. Sets
// handoverAt/agentId (existing Lead fields, unused since Phase 3B) and
// logs a human-attributed activity entry. Does not change Lead.status —
// handover is a separate business fact, not a classification outcome, so
// no LeadStatusHistory row is written here.
export async function handoverLead(leadId: string, actor: Actor, agentId?: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new LeadNotFoundError(leadId);
  if (lead.status !== LeadStatus.hot) throw new LeadNotHotError(leadId, lead.status);

  const resolvedAgentId = agentId ?? actor.id;

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: { handoverAt: new Date(), agentId: resolvedAgentId },
  });

  await logActivity({
    entityType: "lead",
    entityId: leadId,
    action: "lead_handed_over",
    actor,
    metadata: { agentId: resolvedAgentId },
  });

  return updated;
}
