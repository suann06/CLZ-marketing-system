import { NextResponse } from "next/server";
import { requireHumanActorOrResponse } from "@/lib/actor";
import { differentiatorsSchema } from "@/server/validation/campaign-schema";
import {
  setDifferentiators,
  CampaignNotFoundError,
  CampaignNotEditableError,
  CampaignValidationError,
} from "@/server/services/campaign-service";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;

  const { id } = await params;

  const body = await request.json();
  const parsed = differentiatorsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const campaign = await setDifferentiators(id, parsed.data.differentiators, actor);
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
