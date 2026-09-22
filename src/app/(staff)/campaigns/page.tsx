import Link from "next/link";
import { listCampaigns, resumeCampaignPath } from "@/server/services/campaign-service";
import { compareCampaigns, summarizeCampaignFunnel } from "@/server/services/feedback-service";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiGrid, type KpiTileItem } from "@/components/ui/kpi-grid";
import { CampaignList, type CampaignListItem } from "@/components/campaign/campaign-list";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" }).format(date);
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

// Phase 6: Dark Olive Luxury visual migration onto the approved Stitch
// "Campaigns Management" reference. The KPI strip reuses compareCampaigns()
// + summarizeCampaignFunnel() (feedback-service.ts) exactly as
// dashboard-service.ts already does — no new business logic, just the same
// already-exported real aggregation called a second time from this page.
//
// Not reproduced from Stitch (per the approved plan — no fake business
// data): the "Total Ad Spend"/"Avg ROAS" KPI tiles (no ad-spend field
// exists), the carrier/"Bundling" quick-filter pills (no telco/carrier
// field on Campaign), row checkboxes / bulk agent-assignment (would imply
// functionality that doesn't exist), and the "Port Availability Check" /
// "AI Lead Triage Engine" / "Top Campaign Closers" side-rail widgets (no
// real scoring or verified-coverage data source confirmed).
export default async function CampaignsPage() {
  const [campaigns, comparison] = await Promise.all([listCampaigns(), compareCampaigns()]);
  const totals = summarizeCampaignFunnel(comparison.campaigns);

  // Same compareCampaigns() call already used for the KPI strip below —
  // merged in by campaignId so the table can show real leads/sales figures
  // (matching the approved Stitch reference's data-dense table columns)
  // without a second fetch.
  const comparisonByCampaignId = new Map(comparison.campaigns.map((c) => [c.campaignId, c]));

  const items: CampaignListItem[] = campaigns.map((campaign) => {
    const stats = comparisonByCampaignId.get(campaign.id);
    return {
      id: campaign.id,
      name: campaign.name,
      productPromotion: campaign.productPromotion,
      status: campaign.status,
      startDateLabel: formatDate(campaign.startDate),
      endDateLabel: formatDate(campaign.endDate),
      href: resumeCampaignPath(campaign),
      totalLeads: stats?.totalLeads ?? 0,
      wonSales: stats?.wonSales ?? 0,
      lostSales: stats?.lostSales ?? 0,
      totalSalesValue: stats?.totalSalesValue ?? "0.00",
    };
  });

  const kpis: KpiTileItem[] = [
    { label: "Total campaigns", value: String(campaigns.length) },
    { label: "Total leads", value: String(totals.totalLeads) },
    { label: "Total sales value", value: `RM ${totals.totalSalesValue}`, hero: true },
    { label: "Win rate", value: formatRate(totals.winRate) },
  ];

  return (
    <PageContainer maxWidth="max-w-6xl">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground">Campaigns</h1>
          <p className="mt-1 text-sm text-secondary">Every campaign, past and present, in one place.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/feedback" className="text-sm text-secondary hover:text-foreground">
            Feedback
          </Link>
          <Link href="/campaigns/new">
            <Button type="button">New Campaign</Button>
          </Link>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create your first campaign to get started."
          action={
            <Link href="/campaigns/new">
              <Button type="button">New Campaign</Button>
            </Link>
          }
        />
      ) : (
        <>
          <KpiGrid className="mb-6 sm:grid-cols-4" items={kpis} />
          <CampaignList campaigns={items} />
        </>
      )}
    </PageContainer>
  );
}
