import { NextResponse } from "next/server";
import { requireHumanActorOrResponse } from "@/lib/actor";
import {
  confirmCampaign,
  CampaignNotFoundError,
  CampaignNotEditableError,
  CampaignValidationError,
} from "@/server/services/campaign-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;

  const { id } = await params;

  try {
    const campaign = await confirmCampaign(id, actor);
    return NextResponse.json({ campaign });
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof CampaignNotEditableError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof CampaignValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
