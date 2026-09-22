import { listAllLeads } from "@/server/services/lead-query-service";
import { PageContainer } from "@/components/layout/page-container";
import { LeadListView } from "@/components/lead/lead-list-view";
import type { LeadRow } from "@/components/lead/lead-table";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await listAllLeads();

  const rows: LeadRow[] = leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    status: lead.status,
    applicationStatus: lead.applicationStatus,
    agentId: lead.agentId,
    updatedAt: lead.updatedAt.toISOString(),
    campaign: lead.campaign,
  }));

  const campaigns = Array.from(new Map(leads.map((l) => [l.campaign.id, l.campaign])).values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <PageContainer maxWidth="max-w-5xl">
      <div className="mb-7">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground">Leads</h1>
        <p className="mt-1 text-sm text-secondary">Every inbound enquiry, across every campaign.</p>
      </div>
      <LeadListView leads={rows} basePath="/leads" showCampaign campaigns={campaigns} />
    </PageContainer>
  );
}
