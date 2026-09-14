import { NextResponse } from "next/server";
import { requireHumanActorOrResponse } from "@/lib/actor";
import { CampaignNotFoundError } from "@/server/services/campaign-service";
import {
  getLatestMarketingStrategy,
  MarketingStrategyNotFoundError,
} from "@/server/services/marketing-strategy-service";

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
    const strategy = await getLatestMarketingStrategy(id);
    return NextResponse.json({ strategy });
  } catch (err) {
    if (err instanceof CampaignNotFoundError || err instanceof MarketingStrategyNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
