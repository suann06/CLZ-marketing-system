import { NextResponse } from "next/server";
import { acquisitionTrackQuerySchema } from "@/server/validation/acquisition-schema";
import {
  recordAcquisitionEventFromLaunch,
  LaunchNotFoundError,
  InvalidAcquisitionAttributionError,
} from "@/server/services/acquisition-service";

export const dynamic = "force-dynamic";

// The reliable counterpart to /api/acquisition/click: launchId is a path
// segment, not a body field, so campaignId is always derived server-side
// from the Launch itself — there is no way for this request to claim a
// campaign the Launch doesn't actually belong to. Deliberately unauthenticated
// (a customer clicking a generated ad tracking link), matching
// /api/acquisition/click.
//
// Returns 201 JSON (not an HTTP redirect) — this endpoint records
// attribution only. Redirecting the customer to a landing page/WhatsApp
// link is a separate, deployment-specific concern left to whatever
// generates the tracking link in the first place; returning a redirect
// from here would mean trusting a caller-supplied destination URL
// (open-redirect risk) with no persisted, validated destination field to
// redirect to instead.
export async function GET(request: Request, { params }: { params: Promise<{ launchId: string }> }) {
  const { launchId } = await params;

  const url = new URL(request.url);
  const parsed = acquisitionTrackQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const event = await recordAcquisitionEventFromLaunch(launchId, parsed.data);
    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    if (err instanceof LaunchNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof InvalidAcquisitionAttributionError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
