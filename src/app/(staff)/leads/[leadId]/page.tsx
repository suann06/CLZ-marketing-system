import { Fragment } from "react";
import { notFound } from "next/navigation";
import { getLeadDetail } from "@/server/services/lead-query-service";
import { LeadNotFoundError } from "@/server/services/conversation-service";
import { PageContainer } from "@/components/layout/page-container";
import { Card } from "@/components/ui/card";
import { LeadHeader } from "@/components/lead/lead-header";
import { ConversationView } from "@/components/lead/conversation-view";
import { ActivityTimeline } from "@/components/lead/activity-timeline";
import { FollowUpPanel } from "@/components/lead/follow-up-panel";
import { LeadActionsPanel } from "@/components/lead/lead-actions-panel";
import { SimulateWhatsAppForm } from "@/components/lead/simulate-whatsapp-form";

export const dynamic = "force-dynamic";

// Global (cross-campaign) Lead detail — the central customer workspace.
// Same data/components as the campaign-scoped route
// (campaigns/[campaignId]/(workspace)/leads/[leadId]/page.tsx); this one
// simply isn't scoped to a single campaign's URL.
export default async function LeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;

  let detail;
  try {
    detail = await getLeadDetail(leadId);
  } catch (err) {
    if (err instanceof LeadNotFoundError) {
      notFound();
    }
    throw err;
  }

  const { lead, messages, sale, statusHistory, followUps, activity } = detail;

  const customerInfo =
    lead.customerInfo && typeof lead.customerInfo === "object" && !Array.isArray(lead.customerInfo)
      ? (lead.customerInfo as Record<string, unknown>)
      : {};

  return (
    <PageContainer maxWidth="max-w-5xl">
      <LeadHeader
        name={lead.name}
        phone={lead.phone}
        status={lead.status}
        applicationStatus={lead.applicationStatus}
        campaign={lead.campaign}
        agentId={lead.agentId}
        handoverAt={lead.handoverAt ? lead.handoverAt.toISOString() : null}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card title="Customer information" action={<span className="text-xs text-muted">Extracted by stub AI</span>}>
            {Object.keys(customerInfo).length === 0 ? (
              <p className="text-sm text-muted">Nothing extracted yet.</p>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {Object.entries(customerInfo).map(([key, value]) =>
                  value ? (
                    <Fragment key={key}>
                      <dt className="capitalize text-secondary">{key}</dt>
                      <dd className="text-foreground">{String(value)}</dd>
                    </Fragment>
                  ) : null,
                )}
              </dl>
            )}
            {sale && (
              <p className="mt-3 text-sm text-secondary">
                Sale outcome: <span className="font-medium capitalize text-foreground">{sale.status}</span>
                {sale.status === "won" && ` — RM ${sale.saleValue}`}
                {sale.status === "lost" && ` — ${sale.lostReason}`}
              </p>
            )}
          </Card>

          <ConversationView
            messages={messages.map((m) => ({
              id: m.id,
              direction: m.direction,
              content: m.content,
              createdAt: m.createdAt.toISOString(),
            }))}
          />

          <Card title="Simulate another message from this customer">
            <SimulateWhatsAppForm campaignId={lead.campaignId} defaultPhone={lead.phone} lockPhone />
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <LeadActionsPanel
            leadId={lead.id}
            status={lead.status}
            applicationStatus={lead.applicationStatus}
            handoverAt={lead.handoverAt ? lead.handoverAt.toISOString() : null}
            agentId={lead.agentId}
            hasSale={sale !== null}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ActivityTimeline statusHistory={statusHistory} activity={activity} />
        <FollowUpPanel followUps={followUps} />
      </div>
    </PageContainer>
  );
}
