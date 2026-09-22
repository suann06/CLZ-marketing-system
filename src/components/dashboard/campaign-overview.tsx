import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { CampaignComparisonEntry } from "@/server/services/feedback-service";

// Straight from compareCampaigns() (feedback-service.ts) — no calculation
// happens in this component, only formatting/layout. Borderless — a
// section heading + "View all" link stands in for the old Card wrapper.
export function CampaignOverview({ campaigns }: { campaigns: CampaignComparisonEntry[] }) {
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-foreground">Campaign comparison</h2>
        <Link href="/performance" className="text-sm text-primary hover:underline">
          View all in Performance →
        </Link>
      </div>
      {campaigns.length === 0 ? (
        <EmptyState title="No campaigns yet" description="Campaign performance will appear here once you create one." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="border-b border-border py-2.5 pr-4 font-medium">Campaign</th>
                <th className="border-b border-border py-2.5 pr-4 font-medium">Status</th>
                <th className="border-b border-border py-2.5 pr-4 text-right font-medium">Leads</th>
                <th className="border-b border-border py-2.5 pr-4 text-right font-medium">Won / Lost</th>
                <th className="border-b border-border py-2.5 pr-4 text-right font-medium">Sales value</th>
                <th className="border-b border-border py-2.5 pr-0 text-right font-medium">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.campaignId} className="transition-colors duration-150 hover:bg-surface-raised">
                  <td className="border-b border-border py-3 pr-4 font-medium text-foreground">
                    <Link href={`/campaigns/${c.campaignId}/performance`} className="hover:underline">
                      {c.campaignName}
                    </Link>
                  </td>
                  <td className="border-b border-border py-3 pr-4">
                    <Badge variant="dot" status={c.campaignStatus}>
                      {c.campaignStatus.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="border-b border-border py-3 pr-4 text-right font-mono tabular-nums text-foreground">
                    {c.totalLeads}
                  </td>
                  <td className="border-b border-border py-3 pr-4 text-right font-mono tabular-nums text-foreground">
                    {c.wonSales} / {c.lostSales}
                  </td>
                  <td className="border-b border-border py-3 pr-4 text-right font-mono tabular-nums text-foreground">
                    RM {c.totalSalesValue}
                  </td>
                  <td className="border-b border-border py-3 pr-0 text-right font-mono tabular-nums text-foreground">
                    {(c.winRate * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
