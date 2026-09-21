import {
  compareCampaigns,
  compareDatasets,
  compareCreatives,
  getFeedbackSummaryWithExplanation,
} from "@/server/services/feedback-service";

export const dynamic = "force-dynamic";

// Minimal, read-only Stage 11 reporting page — no business logic and no
// direct Prisma access here; every number comes from feedback-service.ts,
// called directly (same convention as every other server-rendered staff
// page), not via an internal fetch to the API route. `explanation` is an
// optional AI-phrased summary of numbers already computed above it — see
// feedback-service.ts's getFeedbackSummaryWithExplanation().
function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function Highlight({ label, highlight }: { label: string; highlight: { id: string; value: number | string } | null }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className="font-medium">
        {highlight
          ? `${highlight.id} (${typeof highlight.value === "number" ? formatRate(highlight.value) : highlight.value})`
          : "Not enough recorded data yet"}
      </p>
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold">Feedback / Data Loop</h1>
      <p className="mb-6 text-sm text-gray-500">
        Advisory, data-driven comparison — nothing here automatically changes any Campaign, dataset, or
        content. All figures are correlational observations, not causal claims.
      </p>

      <section className="mb-8 rounded border border-gray-200 p-4">
        <p className="mb-3 text-sm font-medium">Highest / Lowest Observed Signals</p>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Highlight label="Highest campaign win rate" highlight={campaigns.highestObservedWinRate} />
          <Highlight label="Lowest campaign win rate" highlight={campaigns.lowestObservedWinRate} />
          <Highlight
            label="Highest campaign sales value"
            highlight={
              campaigns.highestObservedSalesValue
                ? { id: campaigns.highestObservedSalesValue.id, value: `RM ${campaigns.highestObservedSalesValue.value}` }
                : null
            }
          />
          <Highlight label="Highest dataset win rate" highlight={datasets.highestObservedWinRate} />
        </div>

        {summary.explanation && (
          <div className="mt-4 rounded border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-blue-600">
              AI-assisted advisory summary (simulated/stub — not a real AI call)
            </p>
            <p>{summary.explanation.summary}</p>
          </div>
        )}
      </section>

      <section className="mb-8 rounded border border-gray-200 p-4">
        <p className="mb-3 text-sm font-medium">Campaign Comparison ({campaigns.campaigns.length})</p>
        {campaigns.campaigns.length === 0 ? (
          <p className="text-sm text-gray-500">No campaigns yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Campaign</th>
                  <th className="py-2 pr-4">Clicks</th>
                  <th className="py-2 pr-4">Won / Lost</th>
                  <th className="py-2 pr-4">Win Rate</th>
                  <th className="py-2 pr-4">Sales Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.campaigns.map((c) => (
                  <tr key={c.campaignId}>
                    <td className="py-2 pr-4 font-medium">{c.campaignName}</td>
                    <td className="py-2 pr-4">{c.totalClicks}</td>
                    <td className="py-2 pr-4">
                      {c.wonSales} / {c.lostSales}
                    </td>
                    <td className="py-2 pr-4">{formatRate(c.winRate)}</td>
                    <td className="py-2 pr-4">RM {c.totalSalesValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-8 rounded border border-gray-200 p-4">
        <p className="mb-3 text-sm font-medium">Dataset Comparison ({datasets.datasets.length})</p>
        {datasets.datasets.length === 0 ? (
          <p className="text-sm text-gray-500">No datasets yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Dataset</th>
                  <th className="py-2 pr-4">Clicks</th>
                  <th className="py-2 pr-4">Won / Lost</th>
                  <th className="py-2 pr-4">Win Rate</th>
                  <th className="py-2 pr-4">Sales Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {datasets.datasets.map((d) => (
                  <tr key={d.datasetId}>
                    <td className="py-2 pr-4 font-medium">{d.datasetName}</td>
                    <td className="py-2 pr-4">{d.totalClicks}</td>
                    <td className="py-2 pr-4">
                      {d.wonSales} / {d.lostSales}
                    </td>
                    <td className="py-2 pr-4">{formatRate(d.winRate)}</td>
                    <td className="py-2 pr-4">RM {d.totalSalesValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded border border-gray-200 p-4">
        <p className="mb-3 text-sm font-medium">Creative Comparison ({creatives.creatives.length})</p>
        {creatives.creatives.length === 0 ? (
          <p className="text-sm text-gray-500">No launches yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Campaign</th>
                  <th className="py-2 pr-4">Platform</th>
                  <th className="py-2 pr-4">Content Set</th>
                  <th className="py-2 pr-4">Variant</th>
                  <th className="py-2 pr-4">Won / Lost</th>
                  <th className="py-2 pr-4">Win Rate</th>
                  <th className="py-2 pr-4">Sales Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {creatives.creatives.map((c) => (
                  <tr key={`${c.campaignId}-${c.contentSetId}-${c.contentSetVersion}-${c.platform}-${c.variantIndex}`}>
                    <td className="py-2 pr-4">{c.campaignId}</td>
                    <td className="py-2 pr-4 capitalize">{c.platform}</td>
                    <td className="py-2 pr-4">v{c.contentSetVersion}</td>
                    <td className="py-2 pr-4">#{c.variantIndex}</td>
                    <td className="py-2 pr-4">
                      {c.wonSales} / {c.lostSales}
                    </td>
                    <td className="py-2 pr-4">{formatRate(c.winRate)}</td>
                    <td className="py-2 pr-4">RM {c.totalSalesValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
