import { EmptyState } from "@/components/ui/empty-state";
import type { SalesTimeSeriesPoint } from "@/server/services/campaign-performance-service";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short" }).format(new Date(iso));
}

// Sales value by day (Sale.closedAt), won sales only — the only timestamp
// basis that's meaningful here (see getSalesTimeSeries()'s own comment).
// Every bar is a real bucketed total; there is no interpolation and no
// synthetic point for a day with no sale. Genuinely omitted (not just
// hidden) when there isn't at least one recorded sale, rather than
// rendering an empty/fabricated chart.
export function SalesTimeSeries({ points }: { points: SalesTimeSeriesPoint[] }) {
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-foreground">Sales value over time</h2>
        {points.length > 0 && <span className="text-xs text-muted">By close date, won sales only</span>}
      </div>
      {points.length === 0 ? (
        <EmptyState
          title="Not enough recorded sales yet"
          description="A day-by-day sales trend will appear here once at least one sale is recorded."
        />
      ) : (
        <PointsChart points={points} />
      )}
    </div>
  );
}

function PointsChart({ points }: { points: SalesTimeSeriesPoint[] }) {
  const max = Math.max(1, ...points.map((p) => Number(p.salesValue)));

  return (
    <div className="flex h-44 items-end gap-3 border-b border-border pb-0 overflow-x-auto">
      {points.map((p) => {
        const heightPct = Math.max(3, Math.round((Number(p.salesValue) / max) * 100));
        return (
          <div key={p.date} className="flex h-full min-w-12 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="font-mono text-xs font-medium tabular-nums text-foreground">RM {p.salesValue}</span>
            <div
              className="w-full rounded-t-md bg-primary transition-[height] duration-300 ease-out"
              style={{ height: `${heightPct}%` }}
              title={`${p.count} sale(s)`}
            />
            <span className="font-mono text-xs text-muted">{formatDate(p.date)}</span>
          </div>
        );
      })}
    </div>
  );
}
