import { listApplications } from "@/server/services/lead-query-service";
import { PageContainer } from "@/components/layout/page-container";
import { ApplicationTable, type ApplicationRow } from "@/components/application/application-table";

export const dynamic = "force-dynamic";

// Not a new entity — a cross-campaign view over existing Lead rows whose
// applicationStatus != not_started (see lead-query-service.ts's
// listApplications()). No new writes, no new model.
export default async function ApplicationsPage() {
  const leads = await listApplications();

  const rows: ApplicationRow[] = leads.map((lead) => ({
    leadId: lead.id,
    customerName: lead.name,
    phone: lead.phone,
    applicationStatus: lead.applicationStatus,
    agentId: lead.agentId,
    updatedAt: lead.updatedAt.toISOString(),
    campaign: lead.campaign,
  }));

  return (
    <PageContainer maxWidth="max-w-5xl">
      <div className="mb-7">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground">Applications</h1>
        <p className="mt-1 text-sm text-secondary">Leads whose application has moved past not started.</p>
      </div>
      <ApplicationTable applications={rows} />
    </PageContainer>
  );
}
