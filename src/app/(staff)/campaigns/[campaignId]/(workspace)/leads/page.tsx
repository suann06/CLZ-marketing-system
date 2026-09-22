import { notFound } from "next/navigation";
import { getCampaignDetail, CampaignNotFoundError } from "@/server/services/campaign-service";
import { listLeadsForCampaign } from "@/server/services/lead-query-service";
import { SimulateWhatsAppForm } from "@/components/lead/simulate-whatsapp-form";
import { LeadListView } from "@/components/lead/lead-list-view";
import type { LeadRow } from "@/components/lead/lead-table";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

// Same CRM visual language as the global /leads page — reuses
// LeadListView/LeadTable/LeadFilters directly (showCampaign=false, since
// every row here is already scoped to this one campaign).
export default async function CampaignLeadsPage({
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

  const leads = await listLeadsForCampaign(campaignId);
  const rows: LeadRow[] = leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    status: lead.status,
    applicationStatus: lead.applicationStatus,
    agentId: lead.agentId,
    updatedAt: lead.updatedAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h2 className="mb-1 text-lg font-semibold">Leads</h2>
      <p className="mb-6 text-sm text-muted">{detail.campaign.name}</p>

      <div className="mb-6 rounded border border-warning bg-warning-bg p-3 text-sm text-warning">
        <strong>Development mode:</strong> there is no real WhatsApp Business connection — this system
        uses a stub provider. Use the form below to simulate an inbound WhatsApp message exactly as a
        real customer message would arrive.
      </div>

      <Card title="Simulate a new WhatsApp enquiry" className="mb-8">
        <SimulateWhatsAppForm campaignId={campaignId} />
      </Card>

      <LeadListView leads={rows} basePath={`/campaigns/${campaignId}/leads`} showCampaign={false} />
    </div>
  );
}
