import { NextResponse } from "next/server";
import { requireHumanActorOrResponse } from "@/lib/actor";
import { CampaignNotFoundError } from "@/server/services/campaign-service";
import {
  getLatestContentSet,
  ContentSetNotFoundError,
} from "@/server/services/content-generation-service";

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
    const contentSet = await getLatestContentSet(id);
    return NextResponse.json({ contentSet });
  } catch (err) {
    if (err instanceof CampaignNotFoundError || err instanceof ContentSetNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
