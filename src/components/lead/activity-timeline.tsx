import { Card } from "@/components/ui/card";

type StatusHistoryEntry = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  actorType: string;
  createdAt: Date;
};

type ActivityLogEntry = {
  id: string;
  entityType: string;
  action: string;
  actorType: string;
  createdAt: Date;
};

type TimelineEntry = {
  id: string;
  createdAt: Date;
  label: string;
  actorType: string;
};

const ACTION_LABELS: Record<string, string> = {
  lead_created: "Lead created",
  lead_customer_info_updated: "Customer info updated by AI",
  lead_classified: "Lead classified",
  lead_status_changed: "Lead status changed",
  lead_handed_over: "Handed over to an agent",
  application_status_changed: "Application status changed",
  follow_up_created: "Follow-up journey started",
  follow_up_cancelled: "Follow-up cancelled",
  follow_up_sent: "Follow-up sent",
  follow_up_send_failed: "Follow-up send failed",
  sale_recorded: "Sale outcome recorded",
  sale_updated: "Sale outcome updated",
};

// Merges LeadStatusHistory + the relevant ActivityLog rows (already fetched
// together by lead-query-service.ts's getLeadDetail()) into one
// chronological read-only timeline. Never invents an entry — every row
// shown here is a row that was already persisted by an existing service
// (lead-classification-service.ts, handover-service.ts,
// application-service.ts, follow-up-service.ts, sale-service.ts).
export function ActivityTimeline({
  statusHistory,
  activity,
}: {
  statusHistory: StatusHistoryEntry[];
  activity: ActivityLogEntry[];
}) {
  const entries: TimelineEntry[] = [
    ...statusHistory.map((h) => ({
      id: `status-${h.id}`,
      createdAt: h.createdAt,
      actorType: h.actorType,
      label: h.fromStatus
        ? `Status changed: ${h.fromStatus} → ${h.toStatus}${h.reason ? ` (${h.reason})` : ""}`
        : `Status set to ${h.toStatus}`,
    })),
    ...activity.map((a) => ({
      id: `activity-${a.id}`,
      createdAt: a.createdAt,
      actorType: a.actorType,
      label: ACTION_LABELS[a.action] ?? a.action.replace(/_/g, " "),
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <Card title="Timeline">
      {entries.length === 0 ? (
        <p className="text-sm text-muted">No activity recorded yet.</p>
      ) : (
        <ol className="relative flex flex-col gap-5 pl-5">
          <span className="absolute top-1.5 bottom-1.5 left-[3px] w-px bg-border" aria-hidden />
          {entries.map((entry) => (
            <li key={entry.id} className="relative text-sm">
              <span
                className="absolute top-1.5 -left-5 h-2 w-2 rounded-full border-2 border-surface bg-primary"
                aria-hidden
              />
              <p className="text-foreground">{entry.label}</p>
              <p className="mt-0.5 text-xs text-muted">
                {entry.createdAt.toLocaleString()} · {entry.actorType}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
