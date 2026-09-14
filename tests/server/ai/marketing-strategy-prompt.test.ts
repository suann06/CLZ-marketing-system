import { describe, expect, it } from "vitest";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type MarketingStrategyInput,
} from "@/server/ai/prompts/marketing-strategy-prompt";

const baseInput: MarketingStrategyInput = {
  campaignId: "c1",
  productPromotion: "Fiber 100Mbps",
  officialPricing: { amount: 99, currency: "MYR", terms: "12-month contract" },
  differentiators: ["Free installation within 3 working days"],
  datasets: [{ name: "CBD Buildings", sourceFilename: "cbd.xlsx", selectedBuildingCount: 2 }],
  targetingAnalysis: {
    totalSelectedBuildings: 2,
    datasetCount: 1,
    byDataset: [
      {
        datasetId: "d1",
        datasetName: "CBD Buildings",
        buildingCount: 2,
        buildingsWithAddress: 1,
        buildingsWithCoordinates: 0,
        availableAttributeKeys: ["Category"],
        categoricalBreakdowns: { Category: { "CAT 2 TIME": 2 } },
      },
    ],
  },
};

describe("buildSystemPrompt", () => {
  it("enforces the required marketing-strategy rules", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toMatch(/factual campaign, pricing, and promotion information/i);
    expect(prompt).toMatch(/differentiators/i);
    expect(prompt).toMatch(/do not invent/i);
    expect(prompt).toMatch(/do not modify or reinterpret the source data/i);
    expect(prompt).toMatch(/platform-specific content generation/i);
    expect(prompt).toMatch(/not.*reusable creative content|not simply be reused/i);
    expect(prompt).toMatch(/ONLY a single JSON object/i);
  });
});

describe("buildUserPrompt", () => {
  it("includes campaign, pricing, differentiators, dataset, and targeting facts", () => {
    const prompt = buildUserPrompt(baseInput);

    expect(prompt).toContain("Fiber 100Mbps");
    expect(prompt).toContain("Amount: 99");
    expect(prompt).toContain("Currency: MYR");
    expect(prompt).toContain("12-month contract");
    expect(prompt).toContain("Free installation within 3 working days");
    expect(prompt).toContain("CBD Buildings");
    expect(prompt).toContain("cbd.xlsx");
    expect(prompt).toContain("Category");
    expect(prompt).toContain("CAT 2 TIME (2)");
  });

  it("explicitly marks unavailable fields instead of omitting or inventing them", () => {
    const input: MarketingStrategyInput = {
      ...baseInput,
      officialPricing: {},
      differentiators: [],
      targetingAnalysis: {
        totalSelectedBuildings: 1,
        datasetCount: 1,
        byDataset: [
          {
            datasetId: "d1",
            datasetName: "CBD Buildings",
            buildingCount: 1,
            buildingsWithAddress: 0,
            buildingsWithCoordinates: 0,
            availableAttributeKeys: [],
            categoricalBreakdowns: {},
          },
        ],
      },
    };

    const prompt = buildUserPrompt(input);

    expect(prompt).toContain("Amount: not available");
    expect(prompt).toContain("Currency: not available");
    expect(prompt).toContain("Terms: not available");
    expect(prompt).toContain("None provided.");
    expect(prompt).toContain("none available");
  });
});
