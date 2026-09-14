import { NextResponse } from "next/server";
import { acquisitionClickSchema } from "@/server/validation/acquisition-schema";
import { recordAcquisitionEvent } from "@/server/services/acquisition-service";
import { CampaignNotFoundError } from "@/server/services/campaign-service";

export const dynamic = "force-dynamic";

// Deliberately no auth gate (unlike every /api/campaigns/* route) — this is
// a customer-facing tracking endpoint (ad click -> attribution), not a
// staff operation. See acquisition-service.ts.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = acquisitionClickSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const event = await recordAcquisitionEvent(parsed.data);
    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
