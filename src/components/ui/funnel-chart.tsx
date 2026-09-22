export type FunnelBarStage = {
  key: string;
  label: string;
  count: number;
  /** Conversion rate from the previous stage into this one. `undefined` for
   * the first stage (no previous stage). `null` when the rate genuinely
   * cannot be computed (e.g. Ads -> Clicks: no ad-impression data is ever
   * captured) — rendered as "not captured", never fabricated as 0%. */
  rate?: number | null;
};

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

// Borderless funnel shared by the Dashboard and the Performance pages — one
// implementation instead of two near-identical ones. Each stage is a
// trapezoid (clip-path) whose top/bottom widths track this stage's and the
// next stage's share of the largest stage, so the shape itself tapers like
// an actual funnel rather than reading as a row of flat progress bars. No
// Card wrapper: a section heading above it is enough (see the approved
// visual identity spec — "do not put the funnel inside a heavy bordered
// Card").
export function FunnelChart({ stages }: { stages: FunnelBarStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  const fills = ["bg-primary", "bg-primary/80", "bg-primary/62", "bg-primary/46", "bg-primary/34"];

  function widthPct(count: number, isTail: boolean) {
    return Math.max(isTail ? 10 : 16, Math.round((count / max) * 100));
  }

  return (
    <div className="flex flex-col gap-1.5">
      {stages.map((stage, i) => {
        const isLast = i === stages.length - 1;
        const topPct = widthPct(stage.count, false);
        const bottomPct = isLast
          ? Math.max(10, Math.round(topPct * 0.82))
          : widthPct(stages[i + 1].count, false);
        const topInset = (100 - topPct) / 2;
        const bottomInset = (100 - bottomPct) / 2;

        return (
          <div key={stage.key}>
            {i > 0 && (
              <p className="mb-1.5 text-center font-mono text-[11px] text-muted">
                {stage.rate === null || stage.rate === undefined
                  ? "not captured"
                  : `${formatRate(stage.rate)} conversion`}
              </p>
            )}
            <div className="flex items-center gap-4">
              <div className="relative h-12 flex-1">
                <div
                  className={`absolute inset-0 ${fills[Math.min(i, fills.length - 1)]} transition-[clip-path] duration-300 ease-out`}
                  style={{
                    clipPath: `polygon(${topInset}% 0%, ${100 - topInset}% 0%, ${100 - bottomInset}% 100%, ${bottomInset}% 100%)`,
                  }}
                />
              </div>
              <div className="flex w-36 shrink-0 items-baseline justify-between gap-2">
                <span className="truncate text-sm text-foreground">{stage.label}</span>
                <span className="font-mono text-sm font-medium tabular-nums text-foreground">{stage.count}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
