import { NextResponse } from "next/server";
import { requireHumanActorOrResponse } from "@/lib/actor";
import { campaignBasicsSchema } from "@/server/validation/campaign-schema";
import { createDraftCampaign, listCampaigns } from "@/server/services/campaign-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;
  void actor;

  const campaigns = await listCampaigns();
  return NextResponse.json({ campaigns });
}

export async function POST(request: Request) {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;

  const body = await request.json();
  const parsed = campaignBasicsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const campaign = await createDraftCampaign(parsed.data, actor);
  return NextResponse.json({ campaign }, { status: 201 });
}
