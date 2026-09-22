import { listSales } from "@/server/services/lead-query-service";
import { PageContainer } from "@/components/layout/page-container";
import { SalesTable, type SaleRow } from "@/components/sale/sales-table";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const sales = await listSales();

  const rows: SaleRow[] = sales.map((sale) => ({
    id: sale.id,
    leadId: sale.leadId,
    customerName: sale.lead.name,
    phone: sale.lead.phone,
    campaign: sale.campaign,
    status: sale.status,
    saleValue: sale.saleValue ? sale.saleValue.toFixed(2) : null,
    lostReason: sale.lostReason,
    closedAt: sale.closedAt.toISOString(),
  }));

  return (
    <PageContainer maxWidth="max-w-5xl">
      <div className="mb-7">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground">Sales</h1>
        <p className="mt-1 text-sm text-secondary">Recorded outcomes, across every campaign.</p>
      </div>
      <SalesTable sales={rows} />
    </PageContainer>
  );
}
