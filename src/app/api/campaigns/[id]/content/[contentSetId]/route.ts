import { NextResponse } from "next/server";
import { requireHumanActorOrResponse } from "@/lib/actor";
import { contentSetOutputSchema } from "@/server/ai/schemas/content-set-output";
import {
  editContentSet,
  ContentSetNotFoundError,
  ContentSetNotEditableError,
} from "@/server/services/content-generation-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; contentSetId: string }> },
) {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;

  const { id, contentSetId } = await params;

  const body = await request.json();
  const parsed = contentSetOutputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const contentSet = await editContentSet(id, contentSetId, parsed.data, actor);
    return NextResponse.json({ contentSet });
  } catch (err) {
    if (err instanceof ContentSetNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof ContentSetNotEditableError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
