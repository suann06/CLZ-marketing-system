import { NextResponse } from "next/server";
import { requireHumanActorOrResponse } from "@/lib/actor";
import { CampaignNotFoundError } from "@/server/services/campaign-service";
import { MarketingStrategyNotApprovedError } from "@/server/services/marketing-strategy-service";
import {
  generateContentSet,
  ContentGenerationError,
} from "@/server/services/content-generation-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;

  const { id } = await params;

  try {
    const contentSet = await generateContentSet(id, actor);
    return NextResponse.json({ contentSet }, { status: 201 });
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof MarketingStrategyNotApprovedError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof ContentGenerationError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }
}
