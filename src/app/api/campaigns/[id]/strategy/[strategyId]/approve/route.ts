import { NextResponse } from "next/server";
import { requireHumanActorOrResponse } from "@/lib/actor";
import {
  approveMarketingStrategy,
  MarketingStrategyNotFoundError,
  MarketingStrategyNotEditableError,
  MarketingStrategyContentInvalidError,
} from "@/server/services/marketing-strategy-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; strategyId: string }> },
) {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;

  const { id, strategyId } = await params;

  try {
    const strategy = await approveMarketingStrategy(id, strategyId, actor);
    return NextResponse.json({ strategy });
  } catch (err) {
    if (err instanceof MarketingStrategyNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof MarketingStrategyNotEditableError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof MarketingStrategyContentInvalidError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
