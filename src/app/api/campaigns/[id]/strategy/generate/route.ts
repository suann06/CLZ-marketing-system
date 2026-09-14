import { NextResponse } from "next/server";
import { requireHumanActorOrResponse } from "@/lib/actor";
import { CampaignNotFoundError, CampaignValidationError } from "@/server/services/campaign-service";
import {
  generateMarketingStrategy,
  AiGenerationError,
} from "@/server/services/marketing-strategy-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;

  const { id } = await params;

  try {
    const strategy = await generateMarketingStrategy(id, actor);
    return NextResponse.json({ strategy }, { status: 201 });
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof CampaignValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof AiGenerationError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }
}
