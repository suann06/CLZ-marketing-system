import Link from "next/link";
import {
  compareCampaigns,
  compareDatasets,
  compareCreatives,
  getFeedbackSummaryWithExplanation,
} from "@/server/services/feedback-service";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

// Learning/advisory page ("what patterns can we learn from campaign
// results") — distinct from Performance (analytical funnel/conversion
// detail) and Dashboard (operational). No business logic and no direct
// Prisma access here; every number comes from feedback-service.ts, called
// directly (same convention as every other server-rendered staff page).
// `explanation` is an optional AI-phrased summary of numbers already
// computed above it — see feedback-service.ts's
// getFeedbackSummaryWithExplanation(). Its wording is validated against
// causal-language guardrails before it ever reaches this page (see
// ai-feedback-explanation-schema.ts) — this page renders it verbatim and
// never rephrases or supplements it with its own generated text.
function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function Signal({ label, highlight }: { label: string; highlight: { id: string; value: number | string } | null }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      {highlight ? (
        <>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-foreground">
            {typeof highlight.value === "number" ? formatRate(highlight.value) : highlight.value}
          </p>
          <p className="mt-0.5 truncate text-xs text-secondary">{highlight.id}</p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted">Not enough recorded data yet</p>
      )}
    </div>
  );
}

export default async function FeedbackPage() {
  const [campaigns, datasets, creatives, summary] = await Promise.all([
    compareCampaigns(),
    compareDatasets(),
    compareCreatives(),
    getFeedbackSummaryWithExplanation(),
  ]);

  // Display-only name resolution — compareCreatives() only carries
  // campaignId (a Launch/ContentSet always belongs to exactly one
  // Campaign, but is compared system-wide across all of them, see
  // feedback-service.ts's own comment on compareCreatives()). Reuses the
  // campaign list already fetched above for the Campaign Comparison
  // section instead of a second query.
  const campaignNameById = new Map(campaigns.campaigns.map((c) => [c.campaignId, c.campaignName]));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground">Feedback</h1>
      <p className="mt-1.5 mb-10 max-w-2xl text-sm text-secondary">
        Advisory, data-driven comparison — nothing here automatically changes any campaign, targeting,
        strategy, content, or launch configuration. Every figure is a correlational observation based on
        recorded campaign outcomes, not a causal claim.
      </p>

      <div className="mb-12">
        <h2 className="mb-5 text-lg font-semibold text-foreground">Highest / lowest observed signals</h2>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Signal label="Highest observed campaign win rate" highlight={campaigns.highestObservedWinRate} />
          <Signal label="Lowest observed campaign win rate" highlight={campaigns.lowestObservedWinRate} />
          <Signal
            label="Highest observed campaign sales value"
            highlight={
              campaigns.highestObservedSalesValue
                ? { id: campaigns.highestObservedSalesValue.id, value: `RM ${campaigns.highestObservedSalesValue.value}` }
                : null
            }
          />
          <Signal label="Highest observed dataset win rate" highlight={datasets.highestObservedWinRate} />
        </div>

        {summary.explanation && (
          <div className="mt-6 rounded-r-[14px] border-l-2 border-primary bg-accent-subtle p-4 text-sm text-accent-ink">
            <p className="mb-1.5 text-xs font-medium text-accent-ink/70">
              Advisory summary — AI-phrased from the numbers above (simulated/stub, not a real AI call)
            </p>
            <p>{summary.explanation.summary}</p>
            {summary.explanation.highlights.length > 0 && (
              <ul className="mt-2 list-inside list-disc">
                {summary.explanation.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="mb-12">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Campaign comparison ({campaigns.campaigns.length})</h2>
        {campaigns.campaigns.length === 0 ? (
          <EmptyState title="No campaigns yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="border-b border-border py-2.5 pr-4 font-medium">Campaign</th>
                  <th className="border-b border-border py-2.5 pr-4 text-right font-medium">Clicks</th>
                  <th className="border-b border-border py-2.5 pr-4 text-right font-medium">Won / Lost</th>
                  <th className="border-b border-border py-2.5 pr-4 text-right font-medium">Win rate</th>
                  <th className="border-b border-border py-2.5 pr-0 text-right font-medium">Sales value</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.campaigns.map((c) => (
                  <tr key={c.campaignId} className="transition-colors duration-150 hover:bg-surface-raised">
                    <td className="border-b border-border py-3 pr-4 font-medium text-foreground">
                      <Link href={`/campaigns/${c.campaignId}/performance`} className="hover:underline">
                        {c.campaignName}
                      </Link>
                    </td>
                    <td className="border-b border-border py-3 pr-4 text-right font-mono tabular-nums text-foreground">
                      {c.totalClicks}
                    </td>
                    <td className="border-b border-border py-3 pr-4 text-right font-mono tabular-nums text-foreground">
                      {c.wonSales} / {c.lostSales}
                    </td>
                    <td className="border-b border-border py-3 pr-4 text-right font-mono tabular-nums text-foreground">
                      {formatRate(c.winRate)}
                    </td>
                    <td className="border-b border-border py-3 pr-0 text-right font-mono tabular-nums text-foreground">
                      RM {c.totalSalesValue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mb-12">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Dataset comparison ({datasets.datasets.length})</h2>
        {datasets.datasets.length === 0 ? (
          <EmptyState title="No datasets yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="border-b border-border py-2.5 pr-4 font-medium">Dataset</th>
                  <th className="border-b border-border py-2.5 pr-4 text-right font-medium">Clicks</th>
                  <th className="border-b border-border py-2.5 pr-4 text-right font-medium">Won / Lost</th>
                  <th className="border-b border-border py-2.5 pr-4 text-right font-medium">Win rate</th>
                  <th className="border-b border-border py-2.5 pr-0 text-right font-medium">Sales value</th>
                </tr>
              </thead>
              <tbody>
                {datasets.datasets.map((d) => (
                  <tr key={d.datasetId} className="transition-colors duration-150 hover:bg-surface-raised">
                    <td className="border-b border-border py-3 pr-4 font-medium text-foreground">{d.datasetName}</td>
                    <td className="border-b border-border py-3 pr-4 text-right font-mono tabular-nums text-foreground">
                      {d.totalClicks}
                    </td>
                    <td className="border-b border-border py-3 pr-4 text-right font-mono tabular-nums text-foreground">
                      {d.wonSales} / {d.lostSales}
                    </td>
                    <td className="border-b border-border py-3 pr-4 text-right font-mono tabular-nums text-foreground">
                      {formatRate(d.winRate)}
                    </td>
                    <td className="border-b border-border py-3 pr-0 text-right font-mono tabular-nums text-foreground">
                      RM {d.totalSalesValue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Creative comparison ({creatives.creatives.length})</h2>
        {creatives.creatives.length === 0 ? (
          <EmptyState title="No launches yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="border-b border-border py-2.5 pr-4 font-medium">Campaign</th>
                  <th className="border-b border-border py-2.5 pr-4 font-medium">Platform</th>
                  <th className="border-b border-border py-2.5 pr-4 font-medium">Variant</th>
                  <th className="border-b border-border py-2.5 pr-4 text-right font-medium">Won / Lost</th>
                  <th className="border-b border-border py-2.5 pr-4 text-right font-medium">Win rate</th>
                  <th className="border-b border-border py-2.5 pr-0 text-right font-medium">Sales value</th>
                </tr>
              </thead>
              <tbody>
                {creatives.creatives.map((c) => (
                  <tr
                    key={`${c.campaignId}-${c.contentSetId}-${c.contentSetVersion}-${c.platform}-${c.variantIndex}`}
                    className="transition-colors duration-150 hover:bg-surface-raised"
                  >
                    <td className="border-b border-border py-3 pr-4">
                      <Link
                        href={`/campaigns/${c.campaignId}/performance`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {campaignNameById.get(c.campaignId) ?? c.campaignId}
                      </Link>
                    </td>
                    <td className="border-b border-border py-3 pr-4 text-secondary capitalize">{c.platform}</td>
                    <td className="border-b border-border py-3 pr-4 text-secondary">
                      v{c.contentSetVersion} #{c.variantIndex}
                    </td>
                    <td className="border-b border-border py-3 pr-4 text-right font-mono tabular-nums text-foreground">
                      {c.wonSales} / {c.lostSales}
                    </td>
                    <td className="border-b border-border py-3 pr-4 text-right font-mono tabular-nums text-foreground">
                      {formatRate(c.winRate)}
                    </td>
                    <td className="border-b border-border py-3 pr-0 text-right font-mono tabular-nums text-foreground">
                      RM {c.totalSalesValue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
