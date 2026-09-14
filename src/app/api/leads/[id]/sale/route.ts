import { NextResponse } from "next/server";
import { requireHumanActorOrResponse } from "@/lib/actor";
import { saleOutcomeInputSchema } from "@/server/validation/sale-schema";
import {
  recordSaleOutcome,
  updateSaleOutcome,
  ApplicationNotSubmittedError,
  SaleAlreadyRecordedError,
  SaleNotFoundError,
} from "@/server/services/sale-service";
import { LeadNotFoundError } from "@/server/services/conversation-service";

export const dynamic = "force-dynamic";

// Sale outcomes are exclusively human-recorded — both methods require a
// human actor, matching /api/leads/[id]/handover and
// /api/leads/[id]/application-status.
//
// POST records a new outcome (201); PUT corrects an existing one (200).
// Both delegate entirely to sale-service.ts — no Prisma calls here.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = saleOutcomeInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const sale = await recordSaleOutcome(id, parsed.data, actor);
    return NextResponse.json({ sale }, { status: 201 });
  } catch (err) {
    if (err instanceof LeadNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof ApplicationNotSubmittedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof SaleAlreadyRecordedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = saleOutcomeInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const sale = await updateSaleOutcome(id, parsed.data, actor);
    return NextResponse.json({ sale });
  } catch (err) {
    if (err instanceof LeadNotFoundError || err instanceof SaleNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof ApplicationNotSubmittedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
