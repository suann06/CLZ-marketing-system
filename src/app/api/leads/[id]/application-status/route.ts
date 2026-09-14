import { NextResponse } from "next/server";
import { requireHumanActorOrResponse } from "@/lib/actor";
import { applicationStatusInputSchema } from "@/server/validation/application-status-schema";
import { updateApplicationStatus } from "@/server/services/application-service";
import { LeadNotFoundError } from "@/server/services/conversation-service";

export const dynamic = "force-dynamic";

// PUT (field replacement), matching the existing /api/campaigns/[id]/differentiators
// convention. Human actor required — application-status changes are a
// staff action, never anonymous.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = applicationStatusInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const lead = await updateApplicationStatus(id, parsed.data.applicationStatus, actor);
    return NextResponse.json({ lead });
  } catch (err) {
    if (err instanceof LeadNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
