import { NextResponse } from "next/server";
import { requireHumanActorOrResponse } from "@/lib/actor";
import {
  approveContentSet,
  ContentSetNotFoundError,
  ContentSetNotEditableError,
  ContentSetContentInvalidError,
} from "@/server/services/content-generation-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; contentSetId: string }> },
) {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;

  const { id, contentSetId } = await params;

  try {
    const contentSet = await approveContentSet(id, contentSetId, actor);
    return NextResponse.json({ contentSet });
  } catch (err) {
    if (err instanceof ContentSetNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof ContentSetNotEditableError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof ContentSetContentInvalidError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
