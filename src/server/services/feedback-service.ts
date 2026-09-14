import { prisma } from "@/server/db/client";
import { CampaignNotFoundError } from "@/server/services/campaign-service";

export type CampaignFeedbackItem = {
  leadId: string;
  outcome: "won" | "lost";
  saleValue: string | null;
  closedAt: Date;
};

// Pure read-only data extraction — no writes, no ActivityLog, no AI/
// provider call of any kind. Queries Sale directly (not Lead) so a Lead
// without a Sale simply never appears in the result; absence of a Sale is
// never interpreted as "lost". Every row's campaignId comes from the
// persisted Sale itself (scoped in the where clause), never inferred from
// caller input, so another campaign's Sales can never appear. Nothing is
// duplicated/stored — this always reflects whatever Sale currently holds,
// so a later correction (won -> lost, or a saleValue fix) is reflected on
// the very next call with no separate update step.
export async function getCampaignFeedbackData(campaignId: string): Promise<CampaignFeedbackItem[]> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) throw new CampaignNotFoundError(campaignId);

  const sales = await prisma.sale.findMany({
    where: { campaignId },
    select: { leadId: true, status: true, saleValue: true, closedAt: true },
  });

  return sales.map((sale) => ({
    leadId: sale.leadId,
    outcome: sale.status,
    saleValue: sale.saleValue ? sale.saleValue.toFixed(2) : null,
    closedAt: sale.closedAt,
  }));
}
