import Link from "next/link";
import type { ApplicationStatus, LeadStatus } from "@prisma/client";
import { LeadStatusBadge } from "@/components/lead/lead-status-badge";
import { ApplicationStatusBadge } from "@/components/application/application-status-badge";
import { agentLabel } from "@/components/lead/agent-label";
import { EmptyState } from "@/components/ui/empty-state";

export type LeadRow = {
  id: string;
  name: string | null;
  phone: string;
  status: LeadStatus;
  applicationStatus: ApplicationStatus;
  agentId: string | null;
  updatedAt: string;
  campaign?: { id: string; name: string } | null;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

// Shared between the global Leads list and every campaign-scoped Leads
// list — one visual language, one place to change it. `basePath` (e.g.
// "/leads" or "/campaigns/:campaignId/leads") lets each caller point rows
// at its own route without this component knowing which context it's in
// — a plain string rather than a hrefFor function, since a function prop
// can't cross the Server->Client boundary from a page.tsx that renders
// this (transitively, via LeadListView) without being a Server Action.
// `showCampaign` hides the Campaign column when the caller is already
// campaign-scoped (the column would be redundant there).
export function LeadTable({
  leads,
  basePath,
  showCampaign,
  emptyTitle,
  emptyDescription,
}: {
  leads: LeadRow[];
  basePath: string;
  showCampaign: boolean;
  emptyTitle: string;
  emptyDescription?: string;
}) {
  if (leads.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-surface-muted text-left text-xs text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Customer</th>
            {showCampaign && <th className="px-4 py-3 font-medium">Campaign</th>}
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Application</th>
            <th className="px-4 py-3 font-medium">Agent</th>
            <th className="px-4 py-3 font-medium">Last updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {leads.map((lead) => (
            <tr key={lead.id} className="transition-colors duration-150 hover:bg-surface-raised">
              <td className="px-4 py-3.5">
                <Link href={`${basePath}/${lead.id}`} className="font-medium text-foreground hover:underline">
                  {lead.name || lead.phone}
                </Link>
                {lead.name && <p className="text-xs text-muted">{lead.phone}</p>}
              </td>
              {showCampaign && (
                <td className="px-4 py-3.5 text-secondary">{lead.campaign?.name ?? "—"}</td>
              )}
              <td className="px-4 py-3.5">
                <LeadStatusBadge status={lead.status} variant="dot" />
              </td>
              <td className="px-4 py-3.5">
                <ApplicationStatusBadge status={lead.applicationStatus} variant="dot" />
              </td>
              <td className="px-4 py-3.5 text-secondary">{agentLabel(lead.agentId)}</td>
              <td className="px-4 py-3.5 font-mono text-xs text-muted">{formatDate(lead.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
