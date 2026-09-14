// Isolated on purpose: follow-up-service.ts imports exactly one function
// from this file. Phase 3E deliberately does not build a full AI-provider
// abstraction for follow-up copy (that pattern is reserved for external
// integrations — WhatsApp/AI/Ads providers) — a future AI-generated
// message strategy replaces this file's implementation without touching
// follow-up-service.ts or its call site.
//
// Deterministic and local: no network call, no Anthropic reference.

export type FollowUpLeadContext = {
  name: string | null;
};

export type FollowUpCampaignContext = {
  productPromotion: string;
};

const DAY_MESSAGES: Record<number, (productPromotion: string, name: string | null) => string> = {
  1: (productPromotion, name) =>
    `Hi${name ? ` ${name}` : ""}! Just checking in about ${productPromotion} — happy to answer any questions you might have.`,
  3: (productPromotion, name) =>
    `Hi${name ? ` ${name}` : ""}, following up on ${productPromotion}. Let us know if you'd like more details or are ready to proceed.`,
  7: (productPromotion, name) =>
    `Hi${name ? ` ${name}` : ""}, this is a final check-in about ${productPromotion}. We're here whenever you're ready.`,
};

export function buildFollowUpMessage(
  day: number,
  lead: FollowUpLeadContext,
  campaign: FollowUpCampaignContext,
): string {
  const builder = DAY_MESSAGES[day];
  if (!builder) {
    throw new Error(`No follow-up message template for day ${day}.`);
  }
  return builder(campaign.productPromotion, lead.name);
}
