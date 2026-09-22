"use client";

import { useMemo, useState, type ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";

export type ComparisonColumn<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  // Omit for a column that shouldn't be sortable (e.g. a name/label column
  // already implicitly ordered, or a rendered badge with no natural order).
  sortValue?: (row: T) => number;
  align?: "left" | "right";
};

// Generic sortable comparison table shared by dataset/creative/campaign
// comparisons — client-side sort only, over rows the caller's page.tsx
// already fetched in one query (same "load once, sort/filter in the
// browser" convention used throughout this app). The leading relative-bar
// column is what makes this a *comparison* view rather than a plain data
// table: each row's bar is scaled against the same `barValue` across all
// rows, so relative magnitude reads at a glance.
export function ComparisonTable<T>({
  rows,
  columns,
  rowKey,
  defaultSortKey,
  barValue,
  barLabel,
  emptyTitle,
  emptyDescription,
}: {
  rows: T[];
  columns: ComparisonColumn<T>[];
  rowKey: (row: T) => string;
  defaultSortKey?: string;
  barValue?: (row: T) => number;
  barLabel?: string;
  emptyTitle: string;
  emptyDescription?: string;
}) {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey);
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const sortColumn = columns.find((c) => c.key === sortKey);

  const sorted = useMemo(() => {
    if (!sortColumn?.sortValue) return rows;
    const sign = direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => sign * (sortColumn.sortValue!(a) - sortColumn.sortValue!(b)));
  }, [rows, sortColumn, direction]);

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const maxBarValue = barValue ? Math.max(1, ...rows.map(barValue)) : 0;

  function handleSort(column: ComparisonColumn<T>) {
    if (!column.sortValue) return;
    if (sortKey === column.key) {
      setDirection((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(column.key);
      setDirection("desc");
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            {barValue && <th className="border-b border-border py-2.5 pr-4 font-medium">{barLabel ?? ""}</th>}
            {columns.map((col) => (
              <th
                key={col.key}
                className={`border-b border-border py-2.5 pr-4 font-medium ${col.align === "right" ? "text-right" : ""}`}
              >
                {col.sortValue ? (
                  <button
                    type="button"
                    onClick={() => handleSort(col)}
                    className="inline-flex items-center gap-1 transition-colors duration-150 hover:text-foreground"
                  >
                    {col.label}
                    {sortKey === col.key && <span aria-hidden>{direction === "desc" ? "↓" : "↑"}</span>}
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)} className="transition-colors duration-150 hover:bg-surface-raised">
              {barValue && (
                <td className="w-32 border-b border-border py-3.5 pr-4">
                  <div className="h-1.5 w-24 rounded-full bg-surface-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary"
                      style={{ width: `${Math.max(4, Math.round((barValue(row) / maxBarValue) * 100))}%` }}
                    />
                  </div>
                </td>
              )}
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`border-b border-border py-3.5 pr-4 ${col.align === "right" ? "text-right font-mono tabular-nums" : ""}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
