import { Badge } from "@/components/ui/badge";
import type { StatusKind } from "@/components/ui/status";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" }).format(date);
}

// Presentational only — every field is passed in by (workspace)/layout.tsx,
// which is the only place campaign detail + performance are fetched.
export function CampaignWorkspaceHeader({
  name,
  productPromotion,
  status,
  startDate,
  endDate,
  metrics,
}: {
  name: string;
  productPromotion: string;
  status: StatusKind;
  startDate: Date;
  endDate: Date;
  metrics: { label: string; value: string }[];
}) {
  return (
    <div className="border-b border-border bg-surface px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold">{name}</h1>
          <Badge status={status}>{status.replace("_", " ")}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">
          {productPromotion} · {formatDate(startDate)} – {formatDate(endDate)}
        </p>

        {metrics.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {metrics.map((m) => (
              <div key={m.label}>
                <p className="text-xs text-muted">{m.label}</p>
                <p className="text-sm font-medium">{m.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
