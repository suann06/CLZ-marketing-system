import { NextResponse } from "next/server";
import { compareDatasets } from "@/server/services/feedback-service";

export const dynamic = "force-dynamic";

// Read-only, deterministic comparison — no human actor / ActivityLog, no
// AI call. No Prisma call in the route — fully delegated to
// feedback-service.ts.
export async function GET() {
  const comparison = await compareDatasets();
  return NextResponse.json(comparison);
}
