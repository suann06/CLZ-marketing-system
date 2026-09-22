import { notFound } from "next/navigation";
import { getCampaignDetail, CampaignNotFoundError } from "@/server/services/campaign-service";
import { listSalesForCampaign } from "@/server/services/lead-query-service";
import { SalesTable, type SaleRow } from "@/components/sale/sales-table";

export const dynamic = "force-dynamic";

// New "Sales" workspace tab (approved Dark Olive Luxury IA) — same visual
// language as the global /sales page, reusing SalesTable directly. Real
// data only: listSalesForCampaign() (lead-query-service.ts) is the exact
// same query the global Sales page's listSales() already runs, filtered by
// campaignId; sale-service.ts remains the only writer.
export default async function CampaignSalesPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  let detail;
  try {
    detail = await getCampaignDetail(campaignId);
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      notFound();
    }
    throw err;
  }

  const sales = await listSalesForCampaign(campaignId);
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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h2 className="mb-1 text-lg font-semibold text-foreground">Sales</h2>
      <p className="mb-6 text-sm text-secondary">{detail.campaign.name}</p>
      <SalesTable sales={rows} />
    </div>
  );
}
