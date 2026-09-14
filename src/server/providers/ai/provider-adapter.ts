// The seam between conversation-service.ts and any actual AI backend.
// Mirrors src/server/providers/ads/provider-adapter.ts and
// src/server/providers/whatsapp/provider-adapter.ts exactly: the service
// layer only ever depends on this interface — never on a concrete provider
// — so swapping StubAiProvider for a real provider later requires no
// change to the service, routes, or webhook.
//
// converse() intentionally returns Promise<unknown>, not a typed result —
// a real provider's output (parsed from an LLM's raw text response) is
// untrusted until validated. conversation-service.ts always runs the
// result through ai-conversation-schema.ts's Zod schema before using it,
// exactly like generateStructuredCompletion()'s raw text is validated in
// marketing-strategy-service.ts. This interface never imports the
// Anthropic SDK and never reads ANTHROPIC_API_KEY.

export type AiConversationMessage = {
  direction: "inbound" | "outbound";
  content: string;
  createdAt: Date;
};

// Only the fields defined in this type are ever sent to or requested from
// an AI provider (see ai-conversation-schema.ts) — no Hot/Warm/Cold or any
// other classification field exists here. That belongs to a later phase.
export type AiCustomerInfo = {
  name?: string | null;
  location?: string | null;
  currentProvider?: string | null;
  interest?: string | null;
};

export type AiCampaignContext = {
  productPromotion: string;
  // Kept as opaque JSON, passed through exactly as stored on Campaign —
  // never fabricated or embellished. See Campaign.officialPricing /
  // Campaign.differentiators.
  officialPricing: unknown;
  differentiators: unknown;
};

export type AiConversationRequest = {
  campaign: AiCampaignContext;
  customerInfo: AiCustomerInfo;
  // Chronological order (oldest first), scoped to exactly one
  // WhatsAppThread — never mixed with another Lead/campaign/thread.
  recentMessages: AiConversationMessage[];
  currentMessage: string;
};

export interface AiProviderAdapter {
  readonly providerName: string;
  converse(request: AiConversationRequest): Promise<unknown>;
}
