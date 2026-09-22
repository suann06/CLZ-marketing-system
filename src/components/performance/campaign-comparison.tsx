"use client";

// This whole file constructs `columns` (render/sortValue closures) and
// passes them, along with rowKey/barValue, into ComparisonTable — a
// Client Component. Functions can't cross a Server->Client props boundary
// (only Server Actions can), so this wrapper must itself be a Client
// Component rather than the Server Component it looked like. Card and
// ComparisonTable are both unchanged — Card never receives a function
// prop anywhere, and ComparisonTable already required "use client" for
// its own sort state.
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ComparisonTable, type ComparisonColumn } from "@/components/performance/comparison-table";
import type { CampaignComparisonEntry } from "@/server/services/feedback-service";

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

const COLUMNS: ComparisonColumn<CampaignComparisonEntry>[] = [
  {
    key: "name",
    label: "Campaign",
    render: (c) => (
      <Link href={`/campaigns/${c.campaignId}/performance`} className="font-medium hover:underline">
        {c.campaignName}
      </Link>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (c) => (
      <Badge variant="dot" status={c.campaignStatus}>
        {c.campaignStatus.replace("_", " ")}
      </Badge>
    ),
  },
  {
    key: "leads",
    label: "Leads",
    render: (c) => c.totalLeads,
    sortValue: (c) => c.totalLeads,
    align: "right",
  },
  {
    key: "applications",
    label: "Applications",
    render: (c) => c.totalApplications,
    sortValue: (c) => c.totalApplications,
    align: "right",
  },
  {
    key: "qualified",
    label: "Qualified",
    render: (c) => c.totalQualifiedLeads,
    sortValue: (c) => c.totalQualifiedLeads,
    align: "right",
  },
  {
    key: "sales",
    label: "Won / Lost",
    render: (c) => `${c.wonSales} / ${c.lostSales}`,
    sortValue: (c) => c.wonSales,
    align: "right",
  },
  {
    key: "salesValue",
    label: "Sales Value",
    render: (c) => `RM ${c.totalSalesValue}`,
    sortValue: (c) => Number(c.totalSalesValue),
    align: "right",
  },
  {
    key: "winRate",
    label: "Win Rate",
    render: (c) => formatRate(c.winRate),
    sortValue: (c) => c.winRate,
    align: "right",
  },
  {
    key: "clickToSale",
    label: "Click → Sale",
    render: (c) => formatRate(c.overallClickToSaleRate),
    sortValue: (c) => c.overallClickToSaleRate,
    align: "right",
  },
];

// Cross-campaign comparison — straight from compareCampaigns()
// (feedback-service.ts). Each row links into that campaign's own
// Performance page for the full funnel/dataset/creative breakdown, so
// this table deliberately doesn't repeat that per-campaign detail here.
export function CampaignComparison({ campaigns }: { campaigns: CampaignComparisonEntry[] }) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-foreground">Campaign comparison ({campaigns.length})</h2>
      <ComparisonTable
        rows={campaigns}
        columns={COLUMNS}
        rowKey={(c) => c.campaignId}
        defaultSortKey="salesValue"
        barValue={(c) => Number(c.totalSalesValue)}
        barLabel="Sales value"
        emptyTitle="No campaigns yet"
      />
    </div>
  );
}
