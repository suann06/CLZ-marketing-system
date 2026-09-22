import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiGrid } from "@/components/ui/kpi-grid";
import type { StatusKind } from "@/components/ui/status";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" }).format(date);
}

// Presentational only — every field is passed in by (workspace)/layout.tsx,
// which is the only place campaign detail + performance are fetched.
//
// Phase 6: Launch moved here as a header action (linking to the existing,
// untouched /campaigns/:id/launch route and its LaunchPanel/launch-service.ts
// logic) instead of being a CampaignWorkspaceNav tab — see the approved
// Dark Olive Luxury IA (workspace-nav.tsx).
export function CampaignWorkspaceHeader({
  campaignId,
  name,
  productPromotion,
  status,
  startDate,
  endDate,
  metrics,
}: {
  campaignId: string;
  name: string;
  productPromotion: string;
  status: StatusKind;
  startDate: Date;
  endDate: Date;
  metrics: { label: string; value: string }[];
}) {
  return (
    <div className="border-b border-border bg-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground">{name}</h1>
            <Badge status={status}>{status.replace("_", " ")}</Badge>
          </div>
          <Link href={`/campaigns/${campaignId}/launch`}>
            <Button type="button" size="sm">
              Launch
            </Button>
          </Link>
        </div>
        <p className="mt-1.5 text-sm text-secondary">
          {productPromotion} · {formatDate(startDate)} – {formatDate(endDate)}
        </p>

        {metrics.length > 0 && (
          <KpiGrid className="mt-5 sm:grid-cols-3 xl:grid-cols-6" items={metrics} />
        )}
      </div>
    </div>
  );
}
