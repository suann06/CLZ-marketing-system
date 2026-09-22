"use client";

// Constructs `columns` (render/sortValue closures) for ComparisonTable, a
// Client Component — functions can't cross a Server->Client props
// boundary, so this wrapper must be a Client Component too. See
// campaign-comparison.tsx's own comment for the full explanation.
import { Badge } from "@/components/ui/badge";
import { ComparisonTable, type ComparisonColumn } from "@/components/performance/comparison-table";
import type { CreativePerformance } from "@/server/services/campaign-performance-service";

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

const COLUMNS: ComparisonColumn<CreativePerformance>[] = [
  {
    key: "creative",
    label: "Creative / Variant",
    render: (c) => (
      <span className="inline-flex items-center gap-2">
        <Badge>{c.platform}</Badge>
        <span className="font-medium text-foreground">
          v{c.contentSetVersion} #{c.variantIndex}
        </span>
      </span>
    ),
  },
  { key: "clicks", label: "Clicks", render: (c) => c.clicks, sortValue: (c) => c.clicks, align: "right" },
  {
    key: "enquiries",
    label: "Enquiries",
    render: (c) => c.enquiries,
    sortValue: (c) => c.enquiries,
    align: "right",
  },
  {
    key: "applications",
    label: "Applications",
    render: (c) => c.applications,
    sortValue: (c) => c.applications,
    align: "right",
  },
  {
    key: "qualified",
    label: "Qualified",
    render: (c) => c.qualifiedLeads,
    sortValue: (c) => c.qualifiedLeads,
    align: "right",
  },
  {
    key: "sales",
    label: "Won / Lost",
    render: (c) => `${c.wonSales} / ${c.lostSales}`,
    sortValue: (c) => c.wonSales,
    align: "right",
  },
  {
    key: "salesValue",
    label: "Sales Value",
    render: (c) => `RM ${c.salesValue}`,
    sortValue: (c) => Number(c.salesValue),
    align: "right",
  },
  {
    key: "clickToSale",
    label: "Click → Sale",
    render: (c) => formatRate(c.conversionRates.overallClickToSaleRate),
    sortValue: (c) => c.conversionRates.overallClickToSaleRate,
    align: "right",
  },
];

// Deliberately not styled like a campaign list — each row is one creative
// variant (platform badge + content-set version + variant index), scoped
// to this campaign only (no Campaign column, since it's already implied
// by context). Comparison-oriented via the shared ComparisonTable.
export function CreativeComparison({ creatives }: { creatives: CreativePerformance[] }) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-foreground">Creative performance ({creatives.length})</h2>
      <ComparisonTable
        rows={creatives}
        columns={COLUMNS}
        rowKey={(c) => `${c.contentSetId}-${c.contentSetVersion}-${c.platform}-${c.variantIndex}`}
        defaultSortKey="salesValue"
        barValue={(c) => Number(c.salesValue)}
        barLabel="Sales value"
        emptyTitle="No launches yet"
      />
    </div>
  );
}
