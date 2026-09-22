import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { CampaignComparisonEntry } from "@/server/services/feedback-service";

const WATCHLIST_LIMIT = 5;

// A compact, glanceable slice of the same compareCampaigns() data the full
// "Campaign comparison" table below already renders (campaign-overview.tsx)
// — top N by lead volume, nothing computed here that doesn't already exist
// on CampaignComparisonEntry. Matches the approved Stitch design's
// "Campaign Watchlist" card; the full sortable comparison table stays
// as the detailed view further down the page.
export function CampaignWatchlist({ campaigns }: { campaigns: CampaignComparisonEntry[] }) {
  const top = [...campaigns].sort((a, b) => b.totalLeads - a.totalLeads).slice(0, WATCHLIST_LIMIT);

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">Campaign watchlist</h2>
      {top.length === 0 ? (
        <div className="mt-2">
          <EmptyState title="No campaigns yet" description="Your most active campaigns will appear here." />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {top.map((c) => (
            <Link
              key={c.campaignId}
              href={`/campaigns/${c.campaignId}/performance`}
              className="flex items-center justify-between gap-3 rounded-xl bg-surface-sunken px-3.5 py-2.5 transition-colors duration-150 hover:bg-surface-raised"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{c.campaignName}</span>
                <Badge status={c.campaignStatus} className="shrink-0">
                  {c.campaignStatus.replace("_", " ")}
                </Badge>
              </div>
              <div className="flex shrink-0 flex-col items-end">
                <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {c.totalLeads} leads
                </span>
                <span className="text-xs text-primary">{(c.winRate * 100).toFixed(1)}% win rate</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
