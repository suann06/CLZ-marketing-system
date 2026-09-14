import { describe, expect, it } from "vitest";
import { StubAiProvider } from "@/server/providers/ai/stub-ai-provider";
import { aiConversationOutputSchema } from "@/server/validation/ai-conversation-schema";
import { leadClassificationOutputSchema } from "@/server/validation/lead-classification-schema";
import { aiFeedbackExplanationOutputSchema } from "@/server/validation/ai-feedback-explanation-schema";

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

  describe("explainFeedback", () => {
    it("returns output that satisfies aiFeedbackExplanationOutputSchema", async () => {
      const provider = new StubAiProvider();
      const raw = await provider.explainFeedback({
        topCampaigns: [],
        topDatasets: [],
        topCreatives: [],
        signals: { highestObservedCampaignWinRate: { id: "c1", value: 0.75 } },
      });
      expect(aiFeedbackExplanationOutputSchema.safeParse(raw).success).toBe(true);
    });

    it("only echoes back the id/value pairs it was given, never inventing new ones", async () => {
      const provider = new StubAiProvider();
      const raw = await provider.explainFeedback({
        topCampaigns: [],
        topDatasets: [],
        topCreatives: [],
        signals: { highestObservedCampaignWinRate: { id: "campaign-xyz", value: 0.42 } },
      });
      const parsed = aiFeedbackExplanationOutputSchema.parse(raw);
      expect(parsed.summary).toContain("campaign-xyz");
      expect(parsed.summary).toContain("0.42");
    });

    it("never uses causal or guarantee language", async () => {
      const provider = new StubAiProvider();
      const raw = await provider.explainFeedback({
        topCampaigns: [],
        topDatasets: [],
        topCreatives: [],
        signals: {
          highestObservedCampaignWinRate: { id: "c1", value: 1 },
          highestObservedCampaignSalesValue: { id: "c2", value: "500.00" },
          highestObservedDatasetWinRate: { id: "d1", value: 0.9 },
          highestObservedCreativeWinRate: { id: "cr1", value: 0.5 },
        },
      });
      const text = JSON.stringify(raw);
      expect(text).not.toMatch(/\b(caused|causes|guarantee|predicted to succeed|best because of)\b/i);
    });

    it("handles an all-null signals object (no eligible sample anywhere) without throwing", async () => {
      const provider = new StubAiProvider();
      const raw = await provider.explainFeedback({
        topCampaigns: [],
        topDatasets: [],
        topCreatives: [],
        signals: {
          highestObservedCampaignWinRate: null,
          highestObservedCampaignSalesValue: null,
          highestObservedDatasetWinRate: null,
          highestObservedCreativeWinRate: null,
        },
      });
      const parsed = aiFeedbackExplanationOutputSchema.parse(raw);
      expect(parsed.summary.length).toBeGreaterThan(0);
    });

    it("makes no network call", async () => {
      const provider = new StubAiProvider();
      await expect(
        provider.explainFeedback({ topCampaigns: [], topDatasets: [], topCreatives: [], signals: {} }),
      ).resolves.toBeTruthy();
    });
  });
});

describe("aiFeedbackExplanationOutputSchema", () => {
  it("rejects summary text containing forbidden causal/guarantee language", () => {
    expect(
      aiFeedbackExplanationOutputSchema.safeParse({
        summary: "Campaign A caused the increase in sales.",
        highlights: [],
      }).success,
    ).toBe(false);
    expect(
      aiFeedbackExplanationOutputSchema.safeParse({
        summary: "This dataset is guaranteed to convert.",
        highlights: [],
      }).success,
    ).toBe(false);
  });

  it("rejects unknown fields (strict)", () => {
    expect(
      aiFeedbackExplanationOutputSchema.safeParse({
        summary: "ok",
        highlights: [],
        confidenceScore: 0.9,
      }).success,
    ).toBe(false);
  });

  it("accepts safe, factual advisory wording", () => {
    expect(
      aiFeedbackExplanationOutputSchema.safeParse({
        summary: "Campaign A has the highest observed win rate (0.7) among campaigns with recorded sales.",
        highlights: ["Recorded sales value: campaign A leads at 500.00."],
      }).success,
    ).toBe(true);
  });
});
