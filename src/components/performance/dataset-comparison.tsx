"use client";

// Constructs `columns` (render/sortValue closures) for ComparisonTable, a
// Client Component — functions can't cross a Server->Client props
// boundary, so this wrapper must be a Client Component too. See
// campaign-comparison.tsx's own comment for the full explanation.
import { ComparisonTable, type ComparisonColumn } from "@/components/performance/comparison-table";
import type { DatasetPerformance } from "@/server/services/campaign-performance-service";

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

const COLUMNS: ComparisonColumn<DatasetPerformance>[] = [
  { key: "name", label: "Dataset", render: (d) => <span className="font-medium text-foreground">{d.datasetName}</span> },
  { key: "clicks", label: "Clicks", render: (d) => d.totalClicks, sortValue: (d) => d.totalClicks, align: "right" },
  {
    key: "enquiries",
    label: "Enquiries",
    render: (d) => d.totalEnquiries,
    sortValue: (d) => d.totalEnquiries,
    align: "right",
  },
  {
    key: "applications",
    label: "Applications",
    render: (d) => d.totalApplications,
    sortValue: (d) => d.totalApplications,
    align: "right",
  },
  {
    key: "qualified",
    label: "Qualified",
    render: (d) => d.qualifiedLeads,
    sortValue: (d) => d.qualifiedLeads,
    align: "right",
  },
  {
    key: "sales",
    label: "Won / Lost",
    render: (d) => `${d.wonSales} / ${d.lostSales}`,
    sortValue: (d) => d.wonSales,
    align: "right",
  },
  {
    key: "salesValue",
    label: "Sales Value",
    render: (d) => `RM ${d.totalSalesValue}`,
    sortValue: (d) => Number(d.totalSalesValue),
    align: "right",
  },
  {
    key: "clickToSale",
    label: "Click → Sale",
    render: (d) => formatRate(d.conversionRates.overallClickToSaleRate),
    sortValue: (d) => d.conversionRates.overallClickToSaleRate,
    align: "right",
  },
];

// Comparison-oriented: sortable, with a leading relative-sales-value bar,
// rather than another plain data table — see comparison-table.tsx.
export function DatasetComparison({ datasets }: { datasets: DatasetPerformance[] }) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-foreground">Dataset performance ({datasets.length})</h2>
      <ComparisonTable
        rows={datasets}
        columns={COLUMNS}
        rowKey={(d) => d.datasetId}
        defaultSortKey="salesValue"
        barValue={(d) => Number(d.totalSalesValue)}
        barLabel="Sales value"
        emptyTitle="No dataset-attributed clicks yet"
      />
    </div>
  );
}
