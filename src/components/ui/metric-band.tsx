export type MetricBandItem = {
  label: string;
  value: string;
  hero?: boolean;
  trend?: string;
};

// The replacement for a row of equal-weight KpiCards — see the approved
// visual identity spec's "metric band" pattern. A single borderless strip,
// hairline-divided, with one metric optionally given stronger visual
// weight ("hero") instead of every figure competing equally. Shared by
// the Dashboard, Performance pages, and the Campaign Workspace header so
// the product's "here are the numbers" language reads as one system.
export function MetricBand({ items, className = "" }: { items: MetricBandItem[]; className?: string }) {
  return (
    <div className={`flex flex-wrap border-y border-border ${className}`}>
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`flex-1 basis-40 px-5 py-4 first:pl-0 ${i < items.length - 1 ? "border-r border-border" : ""}`}
        >
          <p className="text-xs text-muted">{item.label}</p>
          <p
            className={`mt-1.5 font-mono font-semibold tabular-nums ${
              item.hero ? "text-[2.1rem] leading-none text-accent-ink" : "text-2xl leading-none text-foreground"
            }`}
          >
            {item.value}
          </p>
          {item.trend && <p className="mt-1.5 text-xs text-success">{item.trend}</p>}
        </div>
      ))}
    </div>
  );
}
