import Link from "next/link";
import { getDashboardOverview } from "@/server/services/dashboard-service";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KpiGrid, type KpiTileItem } from "@/components/ui/kpi-grid";
import { FunnelGrid } from "@/components/ui/funnel-grid";
import { AttentionList } from "@/components/dashboard/attention-list";
import { CampaignWatchlist } from "@/components/dashboard/campaign-watchlist";
import { CampaignOverview } from "@/components/dashboard/campaign-overview";
import { RecentActivity } from "@/components/dashboard/recent-activity";

export const dynamic = "force-dynamic";

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

// Server-rendered (force-dynamic), so this reads the server's clock rather
// than the viewer's — no per-user timezone/profile data exists to do
// better. Time-of-day only, never a guessed name (no display-name field
// exists on the actor — only an auth id, see lib/actor.ts).
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning.";
  if (hour < 18) return "Good afternoon.";
  return "Good evening.";
}

// Phase 6: Dark Olive Luxury visual migration onto the approved Stitch
// "Overview Dashboard" reference. Every section here still reads from
// getDashboardOverview() (dashboard-service.ts) exactly as before — this
// pass changes rendering only, not what's fetched or computed.
//
// Three Stitch elements are deliberately NOT reproduced because there is no
// real data behind them yet (see the approved implementation plan — no
// fake/mock business data in this migration):
//   - "Marketing Capital & Budget Pacing": no ad-spend/budget field exists
//     anywhere in the schema (acquisition-service.ts tracks clicks, not
//     spend).
//   - "Decisions Powered by Data" / AI insights card: no insight-generation
//     service exists.
//   - The historical "Campaign Performance & Sales Trajectory" line chart:
//     dashboard-service.ts returns current-snapshot totals only, no
//     time-series query exists to plot.
export default async function DashboardPage() {
  const overview = await getDashboardOverview();

  const statusCounts = overview.campaigns.reduce<Record<string, number>>((acc, c) => {
    acc[c.campaignStatus] = (acc[c.campaignStatus] ?? 0) + 1;
    return acc;
  }, {});
  const topStatusEntries = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);

  const kpis: KpiTileItem[] = [
    {
      label: "Total campaigns",
      value: String(overview.campaigns.length),
      meta: topStatusEntries[0] ? `${topStatusEntries[0][1]} ${topStatusEntries[0][0].replace("_", " ")}` : undefined,
      metaRight: topStatusEntries[1] ? `${topStatusEntries[1][1]} ${topStatusEntries[1][0].replace("_", " ")}` : undefined,
    },
    { label: "Total leads", value: String(overview.kpis.totalLeads) },
    { label: "Applications", value: String(overview.kpis.totalApplications) },
    { label: "Won sales", value: String(overview.kpis.wonSales), hero: true },
    { label: "Total sales value", value: `RM ${overview.kpis.totalSalesValue}`, hero: true },
    { label: "Win rate", value: formatRate(overview.kpis.winRate) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground">{getGreeting()}</h1>
          <p className="mt-1 text-sm text-secondary">
            How marketing is performing right now, across every campaign.
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button type="button">New Campaign</Button>
        </Link>
      </div>

      <KpiGrid className="mb-6 sm:grid-cols-3 lg:grid-cols-6" items={kpis} />

      <div className="mb-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CampaignWatchlist campaigns={overview.campaigns} />
        </Card>
        <Card className="lg:col-span-7">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Marketing funnel</h2>
          <FunnelGrid stages={overview.funnel} className="sm:grid-cols-3 lg:grid-cols-6" />
        </Card>
      </div>

      <Card className="mb-6">
        <AttentionList attention={overview.attention} />
      </Card>

      <Card className="mb-6">
        <CampaignOverview campaigns={overview.campaigns} />
      </Card>

      <Card>
        <RecentActivity items={overview.recentActivity} />
      </Card>
    </div>
  );
}
