import { Prisma, SaleStatus } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { CampaignNotFoundError } from "@/server/services/campaign-service";

export type CampaignPerformance = {
  campaignId: string;
  totalLeads: number;
  submittedApplications: number;
  wonSales: number;
  lostSales: number;
  totalSales: number;
  winRate: number;
  totalSalesValue: string;
};

// Every number here is derived live from Campaign -> Lead -> Sale on each
// call — nothing is stored or cached, so the result always reflects
// current data. Only this Campaign's own Leads/Sales are ever counted
// (every query below is scoped by campaignId), so another campaign's data
// can never leak in.
export async function getCampaignPerformance(campaignId: string): Promise<CampaignPerformance> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) throw new CampaignNotFoundError(campaignId);

  const [totalLeads, submittedApplications, wonSales, lostSales, wonValueAgg] = await Promise.all([
    prisma.lead.count({ where: { campaignId } }),
    prisma.lead.count({ where: { campaignId, applicationStatus: "submitted" } }),
    prisma.sale.count({ where: { campaignId, status: SaleStatus.won } }),
    prisma.sale.count({ where: { campaignId, status: SaleStatus.lost } }),
    // DB-side Decimal sum — never fetches rows into JS and never touches
    // Float. Lost sales are excluded by the where clause, not by
    // post-filtering, so they can never contribute to revenue.
    prisma.sale.aggregate({
      where: { campaignId, status: SaleStatus.won },
      _sum: { saleValue: true },
    }),
  ]);

  const totalSales = wonSales + lostSales;
  // Rounded to 4 decimal places (matches the 0.6667-style precision in the
  // approved response example). totalSales === 0 short-circuits to 0
  // rather than dividing by zero — never NaN/Infinity.
  const winRate = totalSales === 0 ? 0 : Math.round((wonSales / totalSales) * 10000) / 10000;

  const totalSalesValue = (wonValueAgg._sum.saleValue ?? new Prisma.Decimal(0)).toFixed(2);

  return {
    campaignId,
    totalLeads,
    submittedApplications,
    wonSales,
    lostSales,
    totalSales,
    winRate,
    totalSalesValue,
  };
}
