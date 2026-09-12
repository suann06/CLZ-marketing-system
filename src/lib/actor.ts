import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { createSupabaseServerClient } from "@/server/supabase/server-client";

export type ActorType = "human" | "ai" | "system";

export type Actor = {
  type: ActorType;
  id: string | null;
};

export class UnauthenticatedError extends Error {
  constructor() {
    super("No authenticated staff user for this request.");
    this.name = "UnauthenticatedError";
  }
}

// Phase 1 only ever produces human actors (there is no AI/system automation
// yet), but every service function takes an Actor so Phase 2/3 automation
// can pass { type: "ai" | "system", id: ... } later without a signature
// change.
export async function requireHumanActor(): Promise<Actor> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new UnauthenticatedError();
  }

  return { type: "human", id: user.id };
}

// Route-handler convenience wrapper: returns the actor, or a 401 response to
// return as-is, so every route handler doesn't repeat its own try/catch.
export async function requireHumanActorOrResponse(): Promise<
  { actor: Actor; response?: undefined } | { actor?: undefined; response: NextResponse }
> {
  try {
    const actor = await requireHumanActor();
    return { actor };
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return { response: NextResponse.json({ error: err.message }, { status: 401 }) };
    }
    throw err;
  }
}

export async function logActivity(params: {
  entityType: string;
  entityId: string;
  action: string;
  actor: Actor;
  metadata?: Record<string, unknown>;
}) {
  await prisma.activityLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      actorType: params.actor.type,
      actorId: params.actor.id,
      metadata: (params.metadata ?? {}) as unknown as Prisma.InputJsonValue,
    },
  });
}
