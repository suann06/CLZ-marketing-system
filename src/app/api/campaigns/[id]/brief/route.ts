import { NextResponse } from "next/server";
import { requireHumanActorOrResponse } from "@/lib/actor";
import {
  getCampaignBrief,
  CampaignNotFoundError,
  CampaignValidationError,
} from "@/server/services/campaign-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;
  void actor;

  const { id } = await params;

  try {
    const brief = await getCampaignBrief(id);
    return NextResponse.json({ brief });
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof CampaignValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
