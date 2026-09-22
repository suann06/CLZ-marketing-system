import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import type { DashboardOverview } from "@/server/services/dashboard-service";

const GROUPS: { key: keyof DashboardOverview["attention"]; label: string }[] = [
  { key: "hotLeadsWithoutHandover", label: "Hot leads without handover" },
  { key: "submittedWithoutSale", label: "Submitted applications without a sale" },
  { key: "zeroClickCampaigns", label: "Live campaigns with zero clicks" },
];

// Purely factual, deterministic signals (see dashboard-service.ts) — no AI
// recommendation, no scoring, no invented "insight" text. Borderless — a
// left accent stripe per item stands in for the old bordered-Card
// treatment, so the signal reads as a flagged list, not another module.
export function AttentionList({ attention }: { attention: DashboardOverview["attention"] }) {
  const totalCount = GROUPS.reduce((sum, g) => sum + attention[g.key].length, 0);

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">Attention required</h2>
      {totalCount === 0 ? (
        <div className="mt-2">
          <EmptyState title="Nothing needs attention" description="No operational signals right now." />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-5">
          {GROUPS.filter((g) => attention[g.key].length > 0).map((group) => (
            <div key={group.key}>
              <p className="mb-2 text-xs text-muted">
                {group.label} · {attention[group.key].length}
              </p>
              <ul className="flex flex-col gap-2">
                {attention[group.key].map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex gap-2.5 rounded-r-lg border-l-2 border-warning py-1 pl-3 text-sm text-foreground transition-colors duration-150 hover:bg-surface-raised"
                    >
                      {item.message}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
