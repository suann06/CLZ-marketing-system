import type { ApplicationStatus, LeadStatus } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const LEAD_STATUSES: LeadStatus[] = ["new", "hot", "warm", "cold"];
const APPLICATION_STATUSES: ApplicationStatus[] = ["not_started", "in_progress", "submitted"];

// Purely controlled/presentational — lead-list-view.tsx owns the filter
// state and does the actual (client-side, over an already-loaded list)
// filtering. `campaigns` is omitted entirely (not just hidden) when the
// caller is already campaign-scoped, so there's no redundant "campaign"
// control on /campaigns/:id/leads.
export function LeadFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  applicationStatus,
  onApplicationStatusChange,
  campaigns,
  campaignId,
  onCampaignChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  status: LeadStatus | "all";
  onStatusChange: (value: LeadStatus | "all") => void;
  applicationStatus: ApplicationStatus | "all";
  onApplicationStatusChange: (value: ApplicationStatus | "all") => void;
  campaigns?: { id: string; name: string }[];
  campaignId?: string;
  onCampaignChange?: (value: string) => void;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by name or phone…"
        aria-label="Search leads"
        className="sm:max-w-xs"
      />
      <Select
        value={status}
        onChange={(e) => onStatusChange(e.target.value as LeadStatus | "all")}
        aria-label="Filter by lead status"
        className="sm:w-40"
      >
        <option value="all">All statuses</option>
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
      <Select
        value={applicationStatus}
        onChange={(e) => onApplicationStatusChange(e.target.value as ApplicationStatus | "all")}
        aria-label="Filter by application status"
        className="sm:w-44"
      >
        <option value="all">All applications</option>
        {APPLICATION_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </Select>
      {campaigns && onCampaignChange && (
        <Select
          value={campaignId ?? "all"}
          onChange={(e) => onCampaignChange(e.target.value)}
          aria-label="Filter by campaign"
          className="sm:w-48"
        >
          <option value="all">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
