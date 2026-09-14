import { Prisma, WhatsAppMessageDirection } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { logActivity, type Actor } from "@/lib/actor";

const SYSTEM_ACTOR: Actor = { type: "system", id: null };

export type StoreInboundMessageInput = {
  leadId: string;
  provider?: string;
  externalThreadId?: string;
  content: string;
  externalMessageId?: string | null;
  metadata?: Record<string, unknown>;
};

// One active thread per Lead in Phase 3B — no conversation-management
// complexity. externalThreadId, when not supplied by the inbound payload,
// falls back to a deterministic value derived from the Lead so a thread
// can still be identified/reused on retry without inventing a fake
// provider-owned id (that id space belongs to the real provider only).
function resolveExternalThreadId(leadId: string, externalThreadId?: string): string {
  return externalThreadId ?? `lead-${leadId}`;
}

async function findOrCreateThread(leadId: string, provider: string, externalThreadId: string) {
  const existing = await prisma.whatsAppThread.findFirst({
    where: { leadId, provider, externalThreadId },
  });
  if (existing) {
    return existing;
  }

  return prisma.whatsAppThread.create({
    data: { leadId, provider, externalThreadId },
  });
}

// Finds/creates the Lead's WhatsAppThread and stores one inbound message.
// Framework-agnostic — no Request/Response types here, so the webhook stays
// a thin adapter over this function.
//
// Idempotency: when externalMessageId is supplied, a retried delivery with
// the same externalMessageId for the same thread is not stored twice — the
// existing message row is returned as-is. When externalMessageId is absent,
// no content-based deduplication is attempted (unsafe — could drop a
// legitimate duplicate message from the customer); every such call creates
// a new row, matching the project's find-before-create guard pattern
// (see launch-service.ts) rather than a DB unique constraint that would
// block legitimate retries.
//
// No AI response generation, no outbound send, no Claude/Meta call. The
// provider abstraction under src/server/providers/whatsapp/ exists as a
// seam for future outbound sending (Phase 3C+) — this function never calls
// it.
export async function storeInboundMessage(input: StoreInboundMessageInput) {
  const provider = input.provider ?? "stub";
  const externalThreadId = resolveExternalThreadId(input.leadId, input.externalThreadId);

  const thread = await findOrCreateThread(input.leadId, provider, externalThreadId);

  if (input.externalMessageId) {
    const existingMessage = await prisma.whatsAppMessage.findFirst({
      where: { threadId: thread.id, externalMessageId: input.externalMessageId },
    });
    if (existingMessage) {
      return { thread, message: existingMessage };
    }
  }

  const message = await prisma.whatsAppMessage.create({
    data: {
      threadId: thread.id,
      leadId: input.leadId,
      direction: WhatsAppMessageDirection.inbound,
      content: input.content,
      externalMessageId: input.externalMessageId ?? null,
      metadata: (input.metadata ?? {}) as unknown as Prisma.InputJsonValue,
    },
  });

  await logActivity({
    entityType: "whatsapp_message",
    entityId: message.id,
    action: "whatsapp_message_received",
    actor: SYSTEM_ACTOR,
    metadata: {
      leadId: input.leadId,
      threadId: thread.id,
      externalMessageId: input.externalMessageId ?? null,
    },
  });

  return { thread, message };
}
