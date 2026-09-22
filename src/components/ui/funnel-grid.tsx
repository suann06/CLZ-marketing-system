import type { FunnelBarStage } from "@/components/ui/funnel-chart";

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

// Stitch's funnel/waterfall treatment (Dashboard's "Lead Funnel Matrix",
// the Campaign Detail Workspace's "Conversion Waterfall") is a grid of
// stat tiles, not funnel-chart.tsx's tapering trapezoid bars. Same
// FunnelBarStage[] shape Dashboard and Performance already pass to
// FunnelChart — this is purely a different renderer, no new data.
// See KpiGrid's note — `className` must supply its own responsive column
// classes; only the mobile-first default and gap are baked in here.
export function FunnelGrid({ stages, className = "" }: { stages: FunnelBarStage[]; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      {stages.map((stage, i) => {
        const isLastStage = i === stages.length - 1;
        return (
          <div
            key={stage.key}
            className={`flex flex-col justify-between rounded-xl border p-3.5 transition-colors duration-150 ${
              isLastStage ? "border-primary/40 bg-accent-subtle" : "border-border bg-surface-sunken"
            }`}
          >
            <span className="text-[11px] text-muted">{stage.label}</span>
            <span
              className={`my-1 text-xl font-bold tracking-tight ${isLastStage ? "text-primary" : "text-foreground"}`}
            >
              {stage.count}
            </span>
            {i > 0 && (
              <span className="text-[11px] font-medium text-muted">
                {stage.rate === null || stage.rate === undefined ? "not captured" : `${formatRate(stage.rate)} conv.`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
