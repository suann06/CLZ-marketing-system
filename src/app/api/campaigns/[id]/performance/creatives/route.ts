import { NextResponse } from "next/server";
import { getCreativePerformance } from "@/server/services/campaign-performance-service";
import { CampaignNotFoundError } from "@/server/services/campaign-service";

export const dynamic = "force-dynamic";

// Read-only, derived-only — no human actor / ActivityLog, matching
// /api/campaigns/[id]/performance's precedent (Phase 4B). No Prisma call
// in the route — fully delegated to campaign-performance-service.ts.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const creatives = await getCreativePerformance(id);
    return NextResponse.json({ campaignId: id, creatives });
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
