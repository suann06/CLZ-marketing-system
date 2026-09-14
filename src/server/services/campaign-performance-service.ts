import { Prisma, SaleStatus, LeadStatus, ApplicationStatus, WhatsAppMessageDirection } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { CampaignNotFoundError } from "@/server/services/campaign-service";

// Rounded to 4 decimal places (matches the 0.6667-style precision used
// throughout this service). denominator === 0 short-circuits to 0 rather
// than dividing by zero — never NaN/Infinity, matching every conversion
// rate in this file.
function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 10000;
}

function formatMoney(decimal: Prisma.Decimal | null): string {
  return (decimal ?? new Prisma.Decimal(0)).toFixed(2);
}

export type FunnelConversionRates = {
  // clickThroughRate is deliberately NOT included — this system never
  // captures ad-impression/reach data (only clicks), so a click-through
  // rate cannot be legitimately computed from persisted data. See the
  // Phase 4 final report for this explicit limitation rather than a
  // fabricated value.
  clickToEnquiryRate: number;
  enquiryToApplicationRate: number;
  applicationToQualifiedRate: number;
  qualifiedToSaleRate: number;
  // "where denominator exists" (Stage 10): totalClicks === 0 returns 0,
  // same zero-denominator convention as every other rate here.
  overallClickToSaleRate: number;
};

export type CampaignPerformance = {
  campaignId: string;
  // Stage 10 funnel counts (Ad -> Click -> WhatsApp Enquiry -> Application
  // -> Qualified Lead -> Sale), each defined exactly per the approved
  // Stage 10 funnel definitions:
  totalAds: number; // Launch rows for this campaign
  totalClicks: number; // AcquisitionEvent rows for this campaign
  totalWhatsAppEnquiries: number; // campaign Leads with >=1 inbound WhatsAppMessage
  totalApplications: number; // Lead.applicationStatus === submitted
  totalQualifiedLeads: number; // Lead.status === hot AND applicationStatus === submitted (isQualifiedLead's own definition)
  totalSales: number; // wonSales + lostSales — a Sale row exists (won or lost), never inferred from absence
  wonSales: number;
  lostSales: number;
  totalSalesValue: string; // sum of won Sale.saleValue only; Decimal-safe, formatted to 2dp
  conversionRates: FunnelConversionRates;
  // Retained from Phase 4B for backward compatibility — totalLeads and
  // submittedApplications/winRate are the original Phase 4B field names;
  // totalApplications/totalQualifiedLeads are their Stage 10 funnel-shaped
  // equivalents (submittedApplications === totalApplications exactly).
  totalLeads: number;
  submittedApplications: number;
  winRate: number;
};

// Every number here is derived live from Campaign -> Dataset/Launch ->
// AcquisitionEvent -> Lead -> Sale on each call — nothing is stored or
// cached, so the result always reflects current data. Only this
// Campaign's own rows are ever counted (every query below is scoped by
// campaignId), so another campaign's data can never leak in.
export async function getCampaignPerformance(campaignId: string): Promise<CampaignPerformance> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) throw new CampaignNotFoundError(campaignId);

  const [
    totalAds,
    totalClicks,
    totalLeads,
    totalWhatsAppEnquiries,
    submittedApplications,
    totalQualifiedLeads,
    wonSales,
    lostSales,
    wonValueAgg,
  ] = await Promise.all([
    prisma.launch.count({ where: { campaignId } }),
    prisma.acquisitionEvent.count({ where: { campaignId } }),
    prisma.lead.count({ where: { campaignId } }),
    prisma.lead.count({
      where: { campaignId, messages: { some: { direction: WhatsAppMessageDirection.inbound } } },
    }),
    prisma.lead.count({ where: { campaignId, applicationStatus: ApplicationStatus.submitted } }),
    // Mirrors isQualifiedLead()'s own definition exactly (status hot AND
    // applicationStatus submitted) — a bulk-count equivalent of that
    // per-Lead check, not a separate business rule.
    prisma.lead.count({
      where: { campaignId, status: LeadStatus.hot, applicationStatus: ApplicationStatus.submitted },
    }),
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

  const conversionRates: FunnelConversionRates = {
    clickToEnquiryRate: rate(totalWhatsAppEnquiries, totalClicks),
    enquiryToApplicationRate: rate(submittedApplications, totalWhatsAppEnquiries),
    applicationToQualifiedRate: rate(totalQualifiedLeads, submittedApplications),
    qualifiedToSaleRate: rate(totalSales, totalQualifiedLeads),
    overallClickToSaleRate: rate(totalSales, totalClicks),
  };

  return {
    campaignId,
    totalAds,
    totalClicks,
    totalWhatsAppEnquiries,
    totalApplications: submittedApplications,
    totalQualifiedLeads,
    totalSales,
    wonSales,
    lostSales,
    totalSalesValue: formatMoney(wonValueAgg._sum.saleValue),
    conversionRates,
    totalLeads,
    submittedApplications,
    winRate: rate(wonSales, totalSales),
  };
}

export type DatasetPerformance = {
  datasetId: string;
  datasetName: string;
  totalClicks: number;
  totalEnquiries: number;
  totalApplications: number;
  qualifiedLeads: number;
  totalSales: number;
  wonSales: number;
  lostSales: number;
  totalSalesValue: string;
  conversionRates: FunnelConversionRates;
};

// Dataset attribution comes only from AcquisitionEvent.datasetId (set at
// click time, see acquisition-service.ts) — never guessed from Building
// names/raw attributes. Only datasets this campaign actually targets
// (via CampaignDataset) are included, in the campaign's own targeting
// order.
export async function getDatasetPerformance(campaignId: string): Promise<DatasetPerformance[]> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) throw new CampaignNotFoundError(campaignId);

  const campaignDatasets = await prisma.campaignDataset.findMany({
    where: { campaignId },
    include: { dataset: { select: { id: true, name: true } } },
  });

  return Promise.all(
    campaignDatasets.map(async (cd): Promise<DatasetPerformance> => {
      const leadScope = { campaignId, acquisitionEvent: { datasetId: cd.datasetId } };
      const saleScope = { campaignId, lead: { acquisitionEvent: { datasetId: cd.datasetId } } };

      const [totalClicks, totalEnquiries, totalApplications, qualifiedLeads, wonSales, lostSales, wonValueAgg] =
        await Promise.all([
          prisma.acquisitionEvent.count({ where: { campaignId, datasetId: cd.datasetId } }),
          prisma.lead.count({
            where: { ...leadScope, messages: { some: { direction: WhatsAppMessageDirection.inbound } } },
          }),
          prisma.lead.count({ where: { ...leadScope, applicationStatus: ApplicationStatus.submitted } }),
          prisma.lead.count({
            where: { ...leadScope, status: LeadStatus.hot, applicationStatus: ApplicationStatus.submitted },
          }),
          prisma.sale.count({ where: { ...saleScope, status: SaleStatus.won } }),
          prisma.sale.count({ where: { ...saleScope, status: SaleStatus.lost } }),
          prisma.sale.aggregate({ where: { ...saleScope, status: SaleStatus.won }, _sum: { saleValue: true } }),
        ]);

      const totalSales = wonSales + lostSales;

      return {
        datasetId: cd.datasetId,
        datasetName: cd.dataset.name,
        totalClicks,
        totalEnquiries,
        totalApplications,
        qualifiedLeads,
        totalSales,
        wonSales,
        lostSales,
        totalSalesValue: formatMoney(wonValueAgg._sum.saleValue),
        conversionRates: {
          clickToEnquiryRate: rate(totalEnquiries, totalClicks),
          enquiryToApplicationRate: rate(totalApplications, totalEnquiries),
          applicationToQualifiedRate: rate(qualifiedLeads, totalApplications),
          qualifiedToSaleRate: rate(totalSales, qualifiedLeads),
          overallClickToSaleRate: rate(totalSales, totalClicks),
        },
      };
    }),
  );
}

export type CreativePerformance = {
  campaignId: string;
  contentSetId: string;
  contentSetVersion: number;
  platform: string;
  variantIndex: number;
  clicks: number;
  enquiries: number;
  applications: number;
  qualifiedLeads: number;
  sales: number;
  wonSales: number;
  lostSales: number;
  salesValue: string;
  conversionRates: FunnelConversionRates;
};

type LaunchIdentity = {
  contentSetId: string;
  contentSetVersion: number;
  platform: string;
  variantIndex: number;
};

function creativeKey(l: LaunchIdentity): string {
  return `${l.contentSetId}:${l.contentSetVersion}:${l.platform}:${l.variantIndex}`;
}

// Creative/version identity is exactly (contentSetId, contentSetVersion,
// platform, variantIndex) — the same stable identity Launch already uses
// (see Launch's own doc comment); no separate "Creative" table is
// introduced. Multiple Launch rows can share one logical identity (a
// human retry creates a new row with the same key — see launch-service.ts)
// so rows are grouped here before attribution is queried, using
// `launchId: { in: [...] }` across every row that shares the identity.
export async function getCreativePerformance(campaignId: string): Promise<CreativePerformance[]> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) throw new CampaignNotFoundError(campaignId);

  const launches = await prisma.launch.findMany({
    where: { campaignId },
    select: { id: true, contentSetId: true, contentSetVersion: true, platform: true, variantIndex: true },
  });

  const groups = new Map<string, LaunchIdentity & { launchIds: string[] }>();
  for (const l of launches) {
    const key = creativeKey(l);
    const existing = groups.get(key);
    if (existing) {
      existing.launchIds.push(l.id);
    } else {
      groups.set(key, {
        contentSetId: l.contentSetId,
        contentSetVersion: l.contentSetVersion,
        platform: l.platform,
        variantIndex: l.variantIndex,
        launchIds: [l.id],
      });
    }
  }

  return Promise.all(
    [...groups.values()].map(async (g): Promise<CreativePerformance> => {
      const launchFilter = { launchId: { in: g.launchIds } };
      const leadScope = { campaignId, acquisitionEvent: launchFilter };
      const saleScope = { campaignId, lead: { acquisitionEvent: launchFilter } };

      const [clicks, enquiries, applications, qualifiedLeads, wonSales, lostSales, salesValueAgg] =
        await Promise.all([
          prisma.acquisitionEvent.count({ where: { campaignId, ...launchFilter } }),
          prisma.lead.count({
            where: { ...leadScope, messages: { some: { direction: WhatsAppMessageDirection.inbound } } },
          }),
          prisma.lead.count({ where: { ...leadScope, applicationStatus: ApplicationStatus.submitted } }),
          prisma.lead.count({
            where: { ...leadScope, status: LeadStatus.hot, applicationStatus: ApplicationStatus.submitted },
          }),
          prisma.sale.count({ where: { ...saleScope, status: SaleStatus.won } }),
          prisma.sale.count({ where: { ...saleScope, status: SaleStatus.lost } }),
          prisma.sale.aggregate({ where: { ...saleScope, status: SaleStatus.won }, _sum: { saleValue: true } }),
        ]);

      const sales = wonSales + lostSales;

      return {
        campaignId,
        contentSetId: g.contentSetId,
        contentSetVersion: g.contentSetVersion,
        platform: g.platform,
        variantIndex: g.variantIndex,
        clicks,
        enquiries,
        applications,
        qualifiedLeads,
        sales,
        wonSales,
        lostSales,
        salesValue: formatMoney(salesValueAgg._sum.saleValue),
        conversionRates: {
          clickToEnquiryRate: rate(enquiries, clicks),
          enquiryToApplicationRate: rate(applications, enquiries),
          applicationToQualifiedRate: rate(qualifiedLeads, applications),
          qualifiedToSaleRate: rate(sales, qualifiedLeads),
          overallClickToSaleRate: rate(sales, clicks),
        },
      };
    }),
  );
}
