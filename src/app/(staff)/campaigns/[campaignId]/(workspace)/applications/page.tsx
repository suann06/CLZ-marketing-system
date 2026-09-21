import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

// Placeholder only — a real Applications view is explicit Phase 4D scope,
// same pattern as (staff)/dashboard/page.tsx's Phase 4E placeholder. This
// page exists solely so the workspace nav's Applications tab has somewhere
// real to go, without showing any fabricated numbers or new business logic.
export default function CampaignApplicationsPage() {
  return (
    <PageContainer>
      <EmptyState
        title="Applications coming in Phase 4D"
        description="A dedicated Applications view will be built here in a later Phase 4 step, per the approved proposal. For now, application status is visible per-lead on the Leads tab."
      />
    </PageContainer>
  );
}
