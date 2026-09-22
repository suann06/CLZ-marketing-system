import Link from "next/link";
import type { SaleStatus } from "@prisma/client";
import { SaleStatusBadge } from "@/components/sale/sale-status-badge";
import { EmptyState } from "@/components/ui/empty-state";

export type SaleRow = {
  id: string;
  leadId: string;
  customerName: string | null;
  phone: string;
  campaign: { id: string; name: string };
  status: SaleStatus;
  saleValue: string | null;
  lostReason: string | null;
  closedAt: string;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" }).format(new Date(iso));
}

// Existing Sale records only — sale-service.ts remains the only writer.
// No computed/aggregated financial metrics here (that already exists
// separately in campaign-performance-service.ts / feedback-service.ts);
// this is a row-level list, not a report.
export function SalesTable({ sales }: { sales: SaleRow[] }) {
  if (sales.length === 0) {
    return (
      <EmptyState
        title="No sales recorded yet"
        description="Sale outcomes appear here once an agent records one from a Lead's detail page."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-surface-muted text-left text-xs text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Customer</th>
            <th className="px-4 py-3 font-medium">Campaign</th>
            <th className="px-4 py-3 font-medium">Outcome</th>
            <th className="px-4 py-3 text-right font-medium">Sale value</th>
            <th className="px-4 py-3 font-medium">Closed</th>
            <th className="px-4 py-3 font-medium">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sales.map((sale) => (
            <tr key={sale.id} className="transition-colors duration-150 hover:bg-surface-raised">
              <td className="px-4 py-3.5">
                <Link href={`/leads/${sale.leadId}`} className="font-medium text-foreground hover:underline">
                  {sale.customerName || sale.phone}
                </Link>
                {sale.customerName && <p className="text-xs text-muted">{sale.phone}</p>}
              </td>
              <td className="px-4 py-3.5 text-secondary">{sale.campaign.name}</td>
              <td className="px-4 py-3.5">
                <SaleStatusBadge status={sale.status} variant="dot" />
              </td>
              <td className="px-4 py-3.5 text-right font-mono tabular-nums text-foreground">
                {sale.saleValue ? `RM ${sale.saleValue}` : "—"}
              </td>
              <td className="px-4 py-3.5 font-mono text-xs text-muted">{formatDate(sale.closedAt)}</td>
              <td className="px-4 py-3.5 text-secondary">{sale.lostReason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
