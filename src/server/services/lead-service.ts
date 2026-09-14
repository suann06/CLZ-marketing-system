import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { logActivity, type Actor } from "@/lib/actor";
import { CampaignNotFoundError } from "@/server/services/campaign-service";

// Matches the acquisition-service convention: this path is reached from an
// unauthenticated customer-facing surface (the WhatsApp webhook), so there
// is no human actor to attribute Lead creation to.
const SYSTEM_ACTOR: Actor = { type: "system", id: null };

export type FindOrCreateLeadInput = {
  campaignId: string;
  phone: string;
  name?: string | null;
  customerInfo?: Record<string, unknown>;
  acquisitionEventId?: string | null;
};

// Leads are campaign-scoped: the same phone contacting two different
// campaigns produces two separate Lead rows. Never merges leads across
// campaigns. Reuses the existing Lead for (campaignId, phone) if one
// exists; otherwise creates a new one with status "new" and writes the
// initial LeadStatusHistory row (fromStatus=null -> toStatus=new,
// actorType=system). No Hot/Warm/Cold classification, no AI call, no
// WhatsApp send — this is a data foundation only.
export async function findOrCreateLead(input: FindOrCreateLeadInput) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    select: { id: true },
  });
  if (!campaign) throw new CampaignNotFoundError(input.campaignId);

  const existing = await prisma.lead.findFirst({
    where: { campaignId: input.campaignId, phone: input.phone },
  });
  if (existing) {
    return existing;
  }

  const lead = await prisma.lead.create({
    data: {
      campaignId: input.campaignId,
      phone: input.phone,
      name: input.name ?? null,
      customerInfo: (input.customerInfo ?? {}) as unknown as Prisma.InputJsonValue,
      acquisitionEventId: input.acquisitionEventId ?? null,
    },
  });

  await prisma.leadStatusHistory.create({
    data: {
      leadId: lead.id,
      fromStatus: null,
      toStatus: lead.status,
      actorType: SYSTEM_ACTOR.type,
      actorId: SYSTEM_ACTOR.id,
    },
  });

  await logActivity({
    entityType: "lead",
    entityId: lead.id,
    action: "lead_created",
    actor: SYSTEM_ACTOR,
    metadata: {
      campaignId: input.campaignId,
      phone: input.phone,
      acquisitionEventId: input.acquisitionEventId ?? null,
    },
  });

  return lead;
}
