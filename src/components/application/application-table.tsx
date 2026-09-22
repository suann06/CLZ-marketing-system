import Link from "next/link";
import type { ApplicationStatus } from "@prisma/client";
import { ApplicationStatusBadge } from "@/components/application/application-status-badge";
import { agentLabel } from "@/components/lead/agent-label";
import { EmptyState } from "@/components/ui/empty-state";

export type ApplicationRow = {
  leadId: string;
  customerName: string | null;
  phone: string;
  applicationStatus: ApplicationStatus;
  agentId: string | null;
  updatedAt: string;
  campaign: { id: string; name: string };
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

// Applications are NOT a separate entity — every row here is an existing
// Lead whose applicationStatus has left "not_started" (see
// lead-query-service.ts's listApplications()). Clicking a row goes to the
// existing Lead detail route rather than a duplicated Application detail.
export function ApplicationTable({ applications }: { applications: ApplicationRow[] }) {
  if (applications.length === 0) {
    return (
      <EmptyState
        title="No applications yet"
        description="Applications appear here once a lead's application status moves past “not started”."
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
            <th className="px-4 py-3 font-medium">Application status</th>
            <th className="px-4 py-3 font-medium">Agent</th>
            <th className="px-4 py-3 font-medium">Last updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {applications.map((app) => (
            <tr key={app.leadId} className="transition-colors duration-150 hover:bg-surface-raised">
              <td className="px-4 py-3.5">
                <Link href={`/leads/${app.leadId}`} className="font-medium text-foreground hover:underline">
                  {app.customerName || app.phone}
                </Link>
                {app.customerName && <p className="text-xs text-muted">{app.phone}</p>}
              </td>
              <td className="px-4 py-3.5 text-secondary">{app.campaign.name}</td>
              <td className="px-4 py-3.5">
                <ApplicationStatusBadge status={app.applicationStatus} variant="dot" />
              </td>
              <td className="px-4 py-3.5 text-secondary">{agentLabel(app.agentId)}</td>
              <td className="px-4 py-3.5 font-mono text-xs text-muted">{formatDate(app.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
