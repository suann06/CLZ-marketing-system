import { NextResponse } from "next/server";
import { requireHumanActorOrResponse } from "@/lib/actor";
import { marketingStrategyOutputSchema } from "@/server/ai/schemas/marketing-strategy-output";
import {
  editMarketingStrategy,
  MarketingStrategyNotFoundError,
  MarketingStrategyNotEditableError,
} from "@/server/services/marketing-strategy-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; strategyId: string }> },
) {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;

  const { id, strategyId } = await params;

  const body = await request.json();
  const parsed = marketingStrategyOutputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const strategy = await editMarketingStrategy(id, strategyId, parsed.data, actor);
    return NextResponse.json({ strategy });
  } catch (err) {
    if (err instanceof MarketingStrategyNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof MarketingStrategyNotEditableError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
