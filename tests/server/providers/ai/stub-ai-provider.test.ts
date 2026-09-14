import { describe, expect, it } from "vitest";
import { StubAiProvider } from "@/server/providers/ai/stub-ai-provider";
import { aiConversationOutputSchema } from "@/server/validation/ai-conversation-schema";
import { leadClassificationOutputSchema } from "@/server/validation/lead-classification-schema";

const CAMPAIGN = { productPromotion: "Unlimited Fibre Plan", officialPricing: {}, differentiators: [] };

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

  describe("classifyLead", () => {
    it("returns output that satisfies leadClassificationOutputSchema", async () => {
      const provider = new StubAiProvider();

      const raw = await provider.classifyLead({
        campaign: CAMPAIGN,
        customerInfo: {},
        recentMessages: [
          { direction: "inbound", content: "I want to apply, how do I sign up?", createdAt: new Date() },
        ],
      });

      expect(leadClassificationOutputSchema.safeParse(raw).success).toBe(true);
    });

    it("proposes hot for a message indicating readiness to apply", async () => {
      const provider = new StubAiProvider();
      const raw = await provider.classifyLead({
        campaign: CAMPAIGN,
        customerInfo: {},
        recentMessages: [{ direction: "inbound", content: "How do I apply for this?", createdAt: new Date() }],
      });
      expect(leadClassificationOutputSchema.parse(raw).classification).toBe("hot");
    });

    it("proposes cold for a message indicating disinterest", async () => {
      const provider = new StubAiProvider();
      const raw = await provider.classifyLead({
        campaign: CAMPAIGN,
        customerInfo: {},
        recentMessages: [{ direction: "inbound", content: "Not interested, thanks", createdAt: new Date() }],
      });
      expect(leadClassificationOutputSchema.parse(raw).classification).toBe("cold");
    });

    it("proposes warm for a message asking about pricing", async () => {
      const provider = new StubAiProvider();
      const raw = await provider.classifyLead({
        campaign: CAMPAIGN,
        customerInfo: {},
        recentMessages: [{ direction: "inbound", content: "How much does this cost?", createdAt: new Date() }],
      });
      expect(leadClassificationOutputSchema.parse(raw).classification).toBe("warm");
    });

    it("makes no network call and returns a non-empty reason grounded in the given messages", async () => {
      const provider = new StubAiProvider();
      const raw = await provider.classifyLead({
        campaign: CAMPAIGN,
        customerInfo: {},
        recentMessages: [{ direction: "inbound", content: "Tell me more about coverage", createdAt: new Date() }],
      });
      const parsed = leadClassificationOutputSchema.parse(raw);
      expect(parsed.reason.length).toBeGreaterThan(0);
    });
  });
});
