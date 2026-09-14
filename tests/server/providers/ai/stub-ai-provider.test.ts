import { describe, expect, it } from "vitest";
import { StubAiProvider } from "@/server/providers/ai/stub-ai-provider";
import { aiConversationOutputSchema } from "@/server/validation/ai-conversation-schema";

describe("StubAiProvider", () => {
  it("returns output that satisfies aiConversationOutputSchema", async () => {
    const provider = new StubAiProvider();

    const raw = await provider.converse({
      campaign: { productPromotion: "Unlimited Fibre Plan", officialPricing: {}, differentiators: [] },
      customerInfo: { name: null, location: null, currentProvider: null, interest: null },
      recentMessages: [],
      currentMessage: "Hi, is this available in my area?",
    });

    const parsed = aiConversationOutputSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it("never includes a hot/warm/cold classification field", async () => {
    const provider = new StubAiProvider();

    const raw = await provider.converse({
      campaign: { productPromotion: "Unlimited Fibre Plan", officialPricing: {}, differentiators: [] },
      customerInfo: { name: null, location: null, currentProvider: null, interest: null },
      recentMessages: [],
      currentMessage: "Hi",
    });

    expect(raw).not.toHaveProperty("status");
    expect(raw).not.toHaveProperty("classification");
    expect(JSON.stringify(raw)).not.toMatch(/\b(hot|warm|cold)\b/i);
  });

  it("makes no network call — resolves purely from its arguments", async () => {
    const provider = new StubAiProvider();
    expect(provider.providerName).toBe("stub");
    await expect(
      provider.converse({
        campaign: { productPromotion: "X", officialPricing: {}, differentiators: [] },
        customerInfo: {},
        recentMessages: [],
        currentMessage: "hello",
      }),
    ).resolves.toBeTruthy();
  });
});
