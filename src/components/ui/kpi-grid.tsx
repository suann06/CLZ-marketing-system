export type KpiTileItem = {
  label: string;
  value: string;
  /** Small pill in the tile's top-right corner, e.g. "+4 MoM". Rendered in
   * the success color — every trend pill in the approved Stitch design is
   * a positive-framed figure, never a status color. */
  trend?: string;
  /** Small text, bottom-left of the tile, e.g. "14 Running". */
  meta?: string;
  /** Small text, bottom-right of the tile, e.g. "6 Staged". */
  metaRight?: string;
  /** Highlighted/emphasized tile — olive-tinted border + wash, matching
   * Stitch's "hero" KPI cards (e.g. Gross Commission, Blended ROAS). */
  hero?: boolean;
};

// Stitch's KPI treatment on every screen (Dashboard, Campaigns Management,
// Campaign Detail Workspace): a grid of individually bordered rounded-2xl
// tiles, not metric-band.tsx's borderless single-strip pattern. This is a
// new renderer for the same flat {label, value, trend} shape MetricBand
// already takes — no data-layer change, only pages that adopt it choose
// this over MetricBand.
// `className` must supply its own responsive column classes (e.g.
// "sm:grid-cols-3 xl:grid-cols-6") — only the mobile-first default and gap
// live here, so a caller's breakpoint classes never collide with a baked-in
// one at the same breakpoint.
export function KpiGrid({ items, className = "" }: { items: KpiTileItem[]; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-4 ${className}`}>
      {items.map((item) => (
        <div
          key={item.label}
          className={`relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 transition-colors duration-150 ${
            item.hero
              ? "border-2 border-primary/40 bg-gradient-to-br from-accent-subtle via-surface to-surface shadow-[0_0_24px_-8px_var(--primary)]"
              : "border border-border bg-surface hover:border-border-strong"
          }`}
        >
          {item.hero && (
            <span
              className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl"
              aria-hidden
            />
          )}
          <div className="relative flex items-center justify-between gap-2">
            <span
              className={`text-[11px] font-semibold tracking-wider uppercase ${item.hero ? "text-primary" : "text-muted"}`}
            >
              {item.label}
            </span>
            {item.trend && (
              <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                {item.trend}
              </span>
            )}
          </div>
          <p
            className={`relative my-2 leading-none font-bold tracking-tight text-foreground ${
              item.hero ? "text-[2rem]" : "text-[1.75rem]"
            }`}
          >
            {item.value}
          </p>
          {(item.meta || item.metaRight) && (
            <div className="relative flex items-center justify-between text-xs text-muted">
              <span>{item.meta}</span>
              <span>{item.metaRight}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
