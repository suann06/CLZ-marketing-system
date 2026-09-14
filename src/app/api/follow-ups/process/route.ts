import { NextResponse } from "next/server";
import { processDueFollowUps } from "@/server/services/follow-up-service";

export const dynamic = "force-dynamic";

// System automation, not a staff action — deliberately does NOT call
// requireHumanActorOrResponse() (a scheduler has no human session). In
// place of a human actor, this route requires a shared secret so it isn't
// left open to the public internet: the request must carry
// x-follow-up-trigger-secret matching process.env.FOLLOW_UP_TRIGGER_SECRET.
// If that env var isn't set, the route fails closed (rejects everything)
// rather than being silently unprotected — there is no real scheduler yet
// (RM0 constraint — no paid cron service), so this is the local/dev
// trigger point a future scheduler calls.
export async function POST(request: Request) {
  const expectedSecret = process.env.FOLLOW_UP_TRIGGER_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Follow-up processing is not configured (FOLLOW_UP_TRIGGER_SECRET is not set)." },
      { status: 503 },
    );
  }

  const providedSecret = request.headers.get("x-follow-up-trigger-secret");
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const results = await processDueFollowUps();
  return NextResponse.json({ results });
}
