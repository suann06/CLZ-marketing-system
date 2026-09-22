import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import type { RecentActivityItem } from "@/server/services/dashboard-service";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

// Every row here is an existing ActivityLog row — nothing is invented.
// Quiet, borderless, positioned last — the lowest-emphasis section on the
// page by design (see the approved visual identity spec's Dashboard
// hierarchy: intro -> metrics -> funnel -> attention -> campaigns ->
// activity, last and quietest).
export function RecentActivity({ items }: { items: RecentActivityItem[] }) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-foreground">Recent activity</h2>
      {items.length === 0 ? (
        <EmptyState title="No activity yet" description="Actions across the system will appear here." />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-3 text-sm">
              <div>
                <p className="text-foreground">{item.label}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {item.contextHref ? (
                    <Link href={item.contextHref} className="hover:underline">
                      {item.contextLabel}
                    </Link>
                  ) : (
                    item.contextLabel
                  )}{" "}
                  · {item.actorType}
                </p>
              </div>
              <span className="shrink-0 whitespace-nowrap font-mono text-xs text-muted">
                {formatDate(item.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
