import { describe, expect, it } from "vitest";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type ContentGenerationInput,
} from "@/server/ai/prompts/content-set-prompt";

const baseInput: ContentGenerationInput = {
  campaignId: "c1",
  productPromotion: "Fiber 100Mbps",
  officialPricing: { amount: 99, currency: "MYR", terms: "12-month contract" },
  differentiators: ["Free installation within 3 working days"],
  strategy: {
    targetAudience: { description: "Urban professionals", segments: ["Young professionals"] },
    customerNeeds: ["Reliable internet"],
    positioning: "Fast and reliable fiber for CBD professionals.",
    marketingAngles: ["Speed matters"],
    messagingPillars: [{ title: "Reliability", description: "Always on." }],
    platformDirection: [{ platform: "facebook", direction: "Highlight speed." }],
    cta: "Sign up today",
  },
};

describe("buildSystemPrompt (content)", () => {
  it("enforces platform variant counts, poster-originality, WhatsApp-broadcast-only, and notes isolation", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toMatch(/facebook[\s\S]*instagram[\s\S]*tiktok[\s\S]*whatsapp/i);
    expect(prompt).toMatch(/2-3 distinct, differentiated content variants/i);
    expect(prompt).toMatch(/do not simply restate or copy the official promotional poster/i);
    expect(prompt).toMatch(/promotional\/broadcast marketing copy only/i);
    expect(prompt).toMatch(/do not write conversational dialogue, customer Q&A/i);
    expect(prompt).toMatch(/notes.*field.*internal reviewer-facing rationale only/i);
    expect(prompt).toMatch(/ONLY a single JSON object/i);
  });
});

describe("buildUserPrompt (content)", () => {
  it("includes campaign facts and the full approved strategy content", () => {
    const prompt = buildUserPrompt(baseInput);

    expect(prompt).toContain("Fiber 100Mbps");
    expect(prompt).toContain("Amount: 99");
    expect(prompt).toContain("Currency: MYR");
    expect(prompt).toContain("Free installation within 3 working days");
    expect(prompt).toContain("Urban professionals");
    expect(prompt).toContain("Young professionals");
    expect(prompt).toContain("Reliable internet");
    expect(prompt).toContain("Fast and reliable fiber for CBD professionals.");
    expect(prompt).toContain("Speed matters");
    expect(prompt).toContain("Reliability: Always on.");
    expect(prompt).toContain("facebook: Highlight speed.");
    expect(prompt).toContain("Sign up today");
  });

  it("marks unavailable pricing instead of omitting or inventing it", () => {
    const input: ContentGenerationInput = {
      ...baseInput,
      officialPricing: {},
      differentiators: [],
    };

    const prompt = buildUserPrompt(input);

    expect(prompt).toContain("Amount: not available");
    expect(prompt).toContain("Currency: not available");
    expect(prompt).toContain("Terms: not available");
    expect(prompt).toContain("None provided.");
  });
});
