import type { TargetingAnalysis } from "@/server/services/targeting-analysis";

// Pure string-building only — no Prisma calls, no SDK calls. Fully
// unit-testable without mocking the network or the database.

export type MarketingStrategyInput = {
  campaignId: string;
  productPromotion: string;
  officialPricing: { amount?: number; currency?: string; terms?: string };
  differentiators: string[];
  datasets: { name: string; sourceFilename: string; selectedBuildingCount: number }[];
  targetingAnalysis: TargetingAnalysis;
};

export function buildSystemPrompt(): string {
  return `You are a marketing strategist for CLZ Resources Sdn Bhd, a Malaysian telecom marketing company.

Produce a marketing strategy for the campaign context the user provides. Follow these rules strictly:
1. Use only the factual campaign, pricing, and promotion information provided — do not alter or reinterpret it.
2. Respect and incorporate the CLZ-specific differentiators provided.
3. Base all targeting insights only on the targeting data provided. Where data is marked unavailable, do not invent it.
4. Do not invent building, customer, or location facts that are not present in the provided data.
5. Do not modify or reinterpret the source data — treat it as ground truth.
6. Produce a differentiated marketing strategy, not generic or templated language.
7. Structure the strategy so it can later support platform-specific content generation — do not generate that content yourself here.
8. Do not treat the official promotional poster or official pricing text as reusable creative content — this strategy is strategic direction, not creative copy.

Respond with ONLY a single JSON object — no markdown, no code fences, no commentary before or after it — matching exactly this shape:
{
  "targetAudience": { "description": string, "segments": string[] },
  "customerNeeds": string[],
  "positioning": string,
  "marketingAngles": string[],
  "messagingPillars": [{ "title": string, "description": string }],
  "platformDirection": [{ "platform": "facebook" | "instagram" | "tiktok" | "whatsapp", "direction": string }],
  "cta": string
}`;
}

export function buildUserPrompt(input: MarketingStrategyInput): string {
  const pricing = input.officialPricing;
  const pricingLine = [
    pricing.amount !== undefined ? `Amount: ${pricing.amount}` : "Amount: not available",
    pricing.currency ? `Currency: ${pricing.currency}` : "Currency: not available",
    pricing.terms ? `Terms: ${pricing.terms}` : "Terms: not available",
  ].join("; ");

  const datasetLines =
    input.datasets
      .map((d) => `- ${d.name} (source file: ${d.sourceFilename}) — ${d.selectedBuildingCount} building(s) selected`)
      .join("\n") || "None.";

  const targetingLines =
    input.targetingAnalysis.byDataset
      .map((d) => {
        const attrs =
          d.availableAttributeKeys.length > 0
            ? d.availableAttributeKeys.join(", ")
            : "none available";
        const categoricalEntries = Object.entries(d.categoricalBreakdowns);
        const categorical =
          categoricalEntries.length > 0
            ? categoricalEntries
                .map(
                  ([key, counts]) =>
                    `${key}: ` +
                    Object.entries(counts)
                      .map(([value, count]) => `${value} (${count})`)
                      .join(", "),
                )
                .join("; ")
            : "none available";

        return [
          `Dataset "${d.datasetName}": ${d.buildingCount} building(s) selected.`,
          `  Address available for ${d.buildingsWithAddress} of ${d.buildingCount}.`,
          `  Coordinates available for ${d.buildingsWithCoordinates} of ${d.buildingCount}.`,
          `  Available building attributes: ${attrs}.`,
          `  Categorical breakdowns: ${categorical}.`,
        ].join("\n");
      })
      .join("\n\n") || "None available.";

  const differentiatorsBlock =
    input.differentiators.length > 0
      ? input.differentiators.map((d) => `- ${d}`).join("\n")
      : "None provided.";

  return `CAMPAIGN
Product / Promotion: ${input.productPromotion}

OFFICIAL PRICING
${pricingLine}

DIFFERENTIATORS
${differentiatorsBlock}

SELECTED DATASETS
${datasetLines}

TARGETING DATA
Total selected buildings: ${input.targetingAnalysis.totalSelectedBuildings}

${targetingLines}

Using only the information above, produce the marketing strategy JSON object described in your instructions.`;
}
