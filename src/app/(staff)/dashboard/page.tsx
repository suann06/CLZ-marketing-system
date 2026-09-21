import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

// Placeholder only — the real Dashboard (KPIs, funnel, attention-required,
// recent activity) is explicit Phase 4E scope, not built here. This page
// exists solely so "/" has somewhere real to redirect to in 4A, without
// showing any fabricated numbers.
export default function DashboardPage() {
  return (
    <PageContainer>
      <h1 className="mb-6 text-xl font-semibold">Dashboard</h1>
      <EmptyState
        title="Dashboard coming in Phase 4E"
        description="KPIs, the campaign funnel, and recent activity will be built here in a later Phase 4 step, per the approved proposal. For now, head to Campaigns to continue the workflow."
      />
    </PageContainer>
  );
}
