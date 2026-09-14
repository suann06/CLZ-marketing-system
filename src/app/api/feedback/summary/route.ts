import { NextResponse } from "next/server";
import { getFeedbackSummaryWithExplanation } from "@/server/services/feedback-service";

export const dynamic = "force-dynamic";

// Read-only, compact read model for future Stage 1–3 consumption — no
// human actor / ActivityLog. All numeric fields are deterministic
// (getFeedbackSummaryWithExplanation() computes them before ever touching
// the AI provider); `explanation` is an optional AI-phrased advisory
// summary of those same numbers, or null if unavailable — see
// feedback-service.ts. No Prisma call in the route — fully delegated to
// feedback-service.ts.
export async function GET() {
  const summary = await getFeedbackSummaryWithExplanation();
  return NextResponse.json(summary);
}
