import { describe, expect, it, vi, beforeEach } from "vitest";
import { whatsAppWebhookSchema } from "@/server/validation/whatsapp-webhook-schema";

// Prisma is fully mocked — never touches the real Supabase database. The
// mocked client below deliberately exposes only whatsAppThread.findFirst/
// create and whatsAppMessage.findFirst/create — no `lead.create`, no AI
// client, no provider `.send` call anywhere in this mock. If this service
// ever tried to call any of those, the test would fail loudly with "is not
// a function" — a structural guarantee that no outbound send/AI call
// happens in Phase 3B, not just an assertion.
const { threadFindFirst, threadCreate, messageFindFirst, messageCreate, logActivityMock } = vi.hoisted(() => ({
  threadFindFirst: vi.fn(),
  threadCreate: vi.fn(),
  messageFindFirst: vi.fn(),
  messageCreate: vi.fn(),
  logActivityMock: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    whatsAppThread: { findFirst: threadFindFirst, create: threadCreate },
    whatsAppMessage: { findFirst: messageFindFirst, create: messageCreate },
  },
}));

vi.mock("@/lib/actor", () => ({
  logActivity: logActivityMock,
}));

import { storeInboundMessage } from "@/server/services/whatsapp-service";

describe("whatsAppWebhookSchema", () => {
  it("rejects a missing campaignId", () => {
    expect(
      whatsAppWebhookSchema.safeParse({ phone: "+60123456789", message: "hi" }).success,
    ).toBe(false);
  });

  it("rejects a non-uuid campaignId", () => {
    expect(
      whatsAppWebhookSchema.safeParse({
        campaignId: "not-a-uuid",
        phone: "+60123456789",
        message: "hi",
      }).success,
    ).toBe(false);
  });

  it("rejects a missing phone", () => {
    expect(
      whatsAppWebhookSchema.safeParse({
        campaignId: "11111111-1111-4111-8111-111111111111",
        message: "hi",
      }).success,
    ).toBe(false);
  });

  it("rejects a missing message", () => {
    expect(
      whatsAppWebhookSchema.safeParse({
        campaignId: "11111111-1111-4111-8111-111111111111",
        phone: "+60123456789",
      }).success,
    ).toBe(false);
  });

  it("accepts a valid minimal payload", () => {
    expect(
      whatsAppWebhookSchema.safeParse({
        campaignId: "11111111-1111-4111-8111-111111111111",
        phone: "+60123456789",
        message: "hi",
      }).success,
    ).toBe(true);
  });

  it("accepts a full valid payload", () => {
    expect(
      whatsAppWebhookSchema.safeParse({
        campaignId: "11111111-1111-4111-8111-111111111111",
        phone: "+60123456789",
        message: "hi",
        externalMessageId: "wamid.123",
        externalThreadId: "thread-abc",
        provider: "meta",
        acquisitionEventId: "22222222-2222-4222-8222-222222222222",
      }).success,
    ).toBe(true);
  });
});

describe("storeInboundMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    threadCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "thread-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));
    messageCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "message-1",
      createdAt: new Date(),
      ...data,
    }));
  });

  it("creates a new WhatsAppThread when none exists for the Lead", async () => {
    threadFindFirst.mockResolvedValue(null);
    messageFindFirst.mockResolvedValue(null);

    const { thread } = await storeInboundMessage({ leadId: "lead-1", content: "hello" });

    expect(threadCreate).toHaveBeenCalledWith({
      data: { leadId: "lead-1", provider: "stub", externalThreadId: "lead-lead-1" },
    });
    expect(thread.id).toBe("thread-1");
  });

  it("reuses an existing WhatsAppThread instead of creating a duplicate", async () => {
    const existingThread = { id: "thread-existing", leadId: "lead-1" };
    threadFindFirst.mockResolvedValue(existingThread);
    messageFindFirst.mockResolvedValue(null);

    const { thread } = await storeInboundMessage({ leadId: "lead-1", content: "hello" });

    expect(thread).toBe(existingThread);
    expect(threadCreate).not.toHaveBeenCalled();
  });

  it("stores the inbound message with direction 'inbound'", async () => {
    threadFindFirst.mockResolvedValue({ id: "thread-1" });
    messageFindFirst.mockResolvedValue(null);

    await storeInboundMessage({ leadId: "lead-1", content: "hello" });

    expect(messageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ direction: "inbound", content: "hello", leadId: "lead-1" }),
    });
  });

  it("preserves the supplied externalMessageId on the stored message", async () => {
    threadFindFirst.mockResolvedValue({ id: "thread-1" });
    messageFindFirst.mockResolvedValue(null);

    const { message } = await storeInboundMessage({
      leadId: "lead-1",
      content: "hello",
      externalMessageId: "wamid.123",
    });

    expect(messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ externalMessageId: "wamid.123" }) }),
    );
    expect(message.externalMessageId).toBe("wamid.123");
  });

  it("does not store the same inbound message twice for a duplicate externalMessageId", async () => {
    threadFindFirst.mockResolvedValue({ id: "thread-1" });
    const existingMessage = { id: "message-existing", externalMessageId: "wamid.123" };
    messageFindFirst.mockResolvedValue(existingMessage);

    const { message } = await storeInboundMessage({
      leadId: "lead-1",
      content: "hello",
      externalMessageId: "wamid.123",
    });

    expect(message).toBe(existingMessage);
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it("creates a new row (no unsafe content-based dedup) when externalMessageId is absent", async () => {
    threadFindFirst.mockResolvedValue({ id: "thread-1" });

    await storeInboundMessage({ leadId: "lead-1", content: "hello" });

    expect(messageFindFirst).not.toHaveBeenCalled();
    expect(messageCreate).toHaveBeenCalledTimes(1);
  });
});
