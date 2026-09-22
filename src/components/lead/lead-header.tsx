import Link from "next/link";
import type { ApplicationStatus, LeadStatus } from "@prisma/client";
import { LeadStatusBadge } from "@/components/lead/lead-status-badge";
import { ApplicationStatusBadge } from "@/components/application/application-status-badge";
import { agentLabel } from "@/components/lead/agent-label";

export function LeadHeader({
  name,
  phone,
  status,
  applicationStatus,
  campaign,
  agentId,
  handoverAt,
}: {
  name: string | null;
  phone: string;
  status: LeadStatus;
  applicationStatus: ApplicationStatus;
  campaign: { id: string; name: string };
  agentId: string | null;
  handoverAt: string | null;
}) {
  return (
    <div className="mb-8 border-b border-border pb-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground">{name || phone}</h1>
        <LeadStatusBadge status={status} />
        <ApplicationStatusBadge status={applicationStatus} />
      </div>
      {name && <p className="mt-1.5 text-sm text-secondary">{phone}</p>}

      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <p className="text-xs text-muted">Campaign</p>
          <Link href={`/campaigns/${campaign.id}/brief`} className="font-medium text-foreground hover:underline">
            {campaign.name}
          </Link>
        </div>
        <div>
          <p className="text-xs text-muted">Assignment</p>
          <p className="font-medium text-foreground">
            {agentLabel(agentId)}
            {handoverAt && (
              <span className="ml-1 font-normal text-muted">
                since {new Date(handoverAt).toLocaleString()}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
