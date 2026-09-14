import { NextResponse } from "next/server";
import { getCampaignPerformance } from "@/server/services/campaign-performance-service";
import { CampaignNotFoundError } from "@/server/services/campaign-service";

export const dynamic = "force-dynamic";

// Read-only, derived-only aggregate metrics — no business data is
// modified, so requireHumanActorOrResponse() is deliberately NOT called
// here (per explicit Phase 4B instruction). This differs from every other
// /api/campaigns/[id]/* GET route (brief, strategy, content), which do
// require a human actor since they expose full campaign/lead detail; this
// endpoint only exposes counts and a revenue sum.
//
// No Prisma calls here — everything is delegated to
// campaign-performance-service.ts.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const performance = await getCampaignPerformance(id);
    return NextResponse.json(performance);
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
