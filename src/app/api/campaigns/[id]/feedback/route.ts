import { NextResponse } from "next/server";
import { getCampaignFeedbackData } from "@/server/services/feedback-service";
import { CampaignNotFoundError } from "@/server/services/campaign-service";

export const dynamic = "force-dynamic";

// Read-only structured data extraction — no business data is modified, so
// requireHumanActorOrResponse() is deliberately not called here, matching
// the precedent set by /api/campaigns/[id]/performance in Phase 4B. No
// ActivityLog write either — a GET here is not a business action worth
// auditing. No Prisma call in the route — fully delegated to
// feedback-service.ts.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const feedback = await getCampaignFeedbackData(id);
    return NextResponse.json({ campaignId: id, feedback });
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
