import { NextResponse } from "next/server";
import { requireHumanActorOrResponse } from "@/lib/actor";
import { CampaignNotFoundError } from "@/server/services/campaign-service";
import { ContentSetNotApprovedError } from "@/server/services/content-generation-service";
import {
  requestLaunch,
  getLaunchesForCampaign,
  LaunchValidationError,
} from "@/server/services/launch-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;
  void actor;

  const { id } = await params;

  const launches = await getLaunchesForCampaign(id);
  return NextResponse.json({ launches });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const platform = typeof body?.platform === "string" ? body.platform : undefined;
  const variantIndex = typeof body?.variantIndex === "number" ? body.variantIndex : undefined;

  if (!platform || variantIndex === undefined) {
    return NextResponse.json(
      { error: "Both platform and variantIndex are required." },
      { status: 400 },
    );
  }

  try {
    const launch = await requestLaunch(id, platform, variantIndex, actor);
    return NextResponse.json({ launch }, { status: 201 });
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof ContentSetNotApprovedError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof LaunchValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
