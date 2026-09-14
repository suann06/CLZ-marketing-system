import { NextResponse } from "next/server";
import { requireHumanActorOrResponse } from "@/lib/actor";
import { handoverInputSchema } from "@/server/validation/handover-schema";
import { handoverLead, LeadNotHotError } from "@/server/services/handover-service";
import { LeadNotFoundError } from "@/server/services/conversation-service";

export const dynamic = "force-dynamic";

// Human handover must not be performed anonymously — requireHumanActorOrResponse()
// is required here, unlike the WhatsApp webhook.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;

  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = handoverInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const lead = await handoverLead(id, actor, parsed.data.agentId);
    return NextResponse.json({ lead });
  } catch (err) {
    if (err instanceof LeadNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof LeadNotHotError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
