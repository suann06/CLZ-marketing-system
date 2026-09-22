import Link from "next/link";
import { compareCampaigns, summarizeCampaignFunnel } from "@/server/services/feedback-service";
import { KpiGrid, type KpiTileItem } from "@/components/ui/kpi-grid";
import { FunnelGrid } from "@/components/ui/funnel-grid";
import { CampaignComparison } from "@/components/performance/campaign-comparison";

export const dynamic = "force-dynamic";

// Global, cross-campaign analytical view ("how did campaigns perform,
// where did the funnel convert") — distinct from the Dashboard
// (operational: "what needs attention right now"). Reuses compareCampaigns()
// (feedback-service.ts) entirely; summarizeCampaignFunnel() is the same
// aggregator the Dashboard uses, so this page's totals and the Dashboard's
// KPIs can never drift apart. Deliberately doesn't repeat per-campaign
// dataset/creative detail here — each campaign's own Performance page
// (linked from the comparison table) is where that lives.
export default async function GlobalPerformancePage() {
  const { campaigns } = await compareCampaigns();
  const totals = summarizeCampaignFunnel(campaigns);

  const kpis: KpiTileItem[] = [
    { label: "Total sales value", value: `RM ${totals.totalSalesValue}`, hero: true },
    { label: "Total leads", value: String(totals.totalLeads) },
    { label: "Applications", value: String(totals.totalApplications) },
    { label: "Won sales", value: String(totals.wonSales), hero: true },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground">Performance</h1>
          <p className="mt-1 text-sm text-secondary">
            Cross-campaign analytical comparison, all-time. Open a campaign below for its funnel,
            dataset, and creative detail.
          </p>
        </div>
        <Link href="/feedback" className="text-sm text-primary hover:underline">
          View Feedback →
        </Link>
      </div>

      <KpiGrid className="mb-12 sm:grid-cols-4" items={kpis} />

      <div className="mb-12">
        <h2 className="mb-5 text-lg font-semibold text-foreground">Marketing funnel</h2>
        <FunnelGrid
          className="sm:grid-cols-3 lg:grid-cols-6"
          stages={[
            { key: "ads", label: "Ads", count: totals.totalAds },
            { key: "clicks", label: "Clicks", count: totals.totalClicks, rate: null },
            {
              key: "enquiries",
              label: "WhatsApp Enquiries",
              count: totals.totalWhatsAppEnquiries,
              rate: totals.clickToEnquiryRate,
            },
            {
              key: "applications",
              label: "Applications",
              count: totals.totalApplications,
              rate: totals.enquiryToApplicationRate,
            },
            {
              key: "qualified",
              label: "Qualified",
              count: totals.totalQualifiedLeads,
              rate: totals.applicationToQualifiedRate,
            },
            { key: "sales", label: "Sales", count: totals.totalSales, rate: totals.qualifiedToSaleRate },
          ]}
        />
      </div>

      <CampaignComparison campaigns={campaigns} />
    </div>
  );
}
