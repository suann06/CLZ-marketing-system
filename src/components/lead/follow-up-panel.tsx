import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FollowUpStatus } from "@prisma/client";

type FollowUpRow = {
  id: string;
  day: number;
  scheduledAt: Date;
  status: FollowUpStatus;
  sentAt: Date | null;
  failureReason: string | null;
};

// Surfaces existing FollowUp rows exactly as follow-up-service.ts wrote
// them — no new follow-up business logic, no computed/derived schedule.
export function FollowUpPanel({ followUps }: { followUps: FollowUpRow[] }) {
  return (
    <Card title="Follow-ups">
      {followUps.length === 0 ? (
        <p className="text-sm text-muted">No follow-up journey has been scheduled for this lead.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {followUps.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-medium">Day {f.day}</p>
                <p className="text-xs text-muted">
                  Scheduled {f.scheduledAt.toLocaleString()}
                  {f.sentAt && ` · Sent ${f.sentAt.toLocaleString()}`}
                  {f.failureReason && ` · ${f.failureReason}`}
                </p>
              </div>
              <Badge status={f.status}>{f.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
