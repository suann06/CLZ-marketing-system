import type { FunnelConversionRates } from "@/server/services/campaign-performance-service";

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

const ROWS: { key: keyof FunnelConversionRates; label: string }[] = [
  { key: "clickToEnquiryRate", label: "Click → WhatsApp enquiry" },
  { key: "enquiryToApplicationRate", label: "Enquiry → Application" },
  { key: "applicationToQualifiedRate", label: "Application → Qualified" },
  { key: "qualifiedToSaleRate", label: "Qualified → Sale" },
  { key: "overallClickToSaleRate", label: "Overall click → Sale" },
];

// Purely descriptive — every rate is shown as an observed percentage with
// no qualitative judgment ("good"/"poor"/"underperforming"). This system
// has no backend-defined classification of what counts as a good rate, so
// none is invented here. The purpose is letting staff see where volume is
// lost through the funnel, not to render a verdict. A clean definition
// list rather than a mini-card per rate.
export function ConversionAnalysis({ rates }: { rates: FunnelConversionRates }) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-foreground">Conversion analysis</h2>
      <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between border-b border-border py-3">
            <dt className="text-sm text-secondary">{row.label}</dt>
            <dd className="font-mono text-sm font-medium tabular-nums text-foreground">{formatRate(rates[row.key])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
