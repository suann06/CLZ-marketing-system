import type { MarketingStrategyOutput } from "@/server/ai/schemas/marketing-strategy-output";

// Pure string-building only — no Prisma calls, no SDK calls. Fully
// unit-testable without mocking the network or the database.

export type ContentGenerationInput = {
  campaignId: string;
  productPromotion: string;
  officialPricing: { amount?: number; currency?: string; terms?: string };
  differentiators: string[];
  strategy: MarketingStrategyOutput;
};

export function buildSystemPrompt(): string {
  return `You are a marketing content writer for CLZ Resources Sdn Bhd, a Malaysian telecom marketing company.

Produce platform-specific marketing content for Facebook, Instagram, TikTok, and WhatsApp, based on the approved marketing strategy and campaign facts the user provides. Follow these rules strictly:
1. Use only the factual campaign, pricing, and promotion information provided — do not alter or reinterpret it.
2. Follow the provided marketing strategy's positioning, marketing angles, messaging pillars, and platform direction — do not contradict or ignore it.
3. Respect and incorporate the CLZ-specific differentiators provided.
4. Do not invent facts, offers, or data not present in the provided information.
5. For each platform, produce 2-3 distinct, differentiated content variants — each variant must take a genuinely different angle (e.g. a different messaging pillar or marketing angle), not minor rewordings of the same idea.
6. Do not simply restate or copy the official promotional poster or official pricing text as creative copy — this is original marketing content, not a reproduction of official materials. (Note: no poster asset is provided to you; this rule exists to keep your output original regardless.)
7. WhatsApp content in this task means promotional/broadcast marketing copy only (e.g. an opening broadcast message) — do not write conversational dialogue, customer Q&A, or anything resembling a chat exchange.
8. Each variant's "notes" field, if used, is internal reviewer-facing rationale only — it must never contain customer-facing copy, and customer-facing fields (headline, bodyText, cta, hashtags) must never contain reviewer commentary.

Respond with ONLY a single JSON object — no markdown, no code fences, no commentary before or after it — matching exactly this shape:
{
  "facebook": [{ "variantLabel": string, "headline": string, "bodyText": string, "cta": string, "hashtags": string[] (optional), "notes": string (optional) }],
  "instagram": [ ...same shape... ],
  "tiktok": [ ...same shape... ],
  "whatsapp": [ ...same shape... ]
}
Each platform array must contain at least one variant; aim for 2-3 per platform.`;
}

export function buildUserPrompt(input: ContentGenerationInput): string {
  const pricing = input.officialPricing;
  const pricingLine = [
    pricing.amount !== undefined ? `Amount: ${pricing.amount}` : "Amount: not available",
    pricing.currency ? `Currency: ${pricing.currency}` : "Currency: not available",
    pricing.terms ? `Terms: ${pricing.terms}` : "Terms: not available",
  ].join("; ");

  const differentiatorsBlock =
    input.differentiators.length > 0
      ? input.differentiators.map((d) => `- ${d}`).join("\n")
      : "None provided.";

  const s = input.strategy;

  const messagingPillarsBlock = s.messagingPillars
    .map((p) => `- ${p.title}: ${p.description}`)
    .join("\n");

  const platformDirectionBlock = s.platformDirection
    .map((p) => `- ${p.platform}: ${p.direction}`)
    .join("\n");

  return `CAMPAIGN
Product / Promotion: ${input.productPromotion}

OFFICIAL PRICING
${pricingLine}

DIFFERENTIATORS
${differentiatorsBlock}

APPROVED MARKETING STRATEGY

Target Audience: ${s.targetAudience.description}
Audience Segments: ${s.targetAudience.segments.join(", ")}

Customer Needs:
${s.customerNeeds.map((n) => `- ${n}`).join("\n")}

Positioning: ${s.positioning}

Marketing Angles:
${s.marketingAngles.map((a) => `- ${a}`).join("\n")}

Messaging Pillars:
${messagingPillarsBlock}

Platform Direction:
${platformDirectionBlock}

Strategy CTA: ${s.cta}

Using only the information above, produce the platform-specific content JSON object described in your instructions.`;
}
