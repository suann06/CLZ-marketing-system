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

// Phase 3D: same controlled-context shape as AiConversationRequest, minus
// currentMessage — classification looks at the conversation as a whole,
// not a single latest message. Deliberately has no "sufficient signal"
// flag: lead-classification-service.ts decides whether to call
// classifyLead() at all (see its hasSufficientSignal()) — the provider is
// never asked to abstain, only to classify what it's given.
export type AiClassificationRequest = {
  campaign: AiCampaignContext;
  customerInfo: AiCustomerInfo;
  recentMessages: AiConversationMessage[];
};

// Stage 11 (Phase 4 final): the AI is given ONLY already-computed,
// deterministic numbers/ids — see feedback-service.ts's
// getFeedbackSummaryWithExplanation(), which always calculates
// topCampaigns/topDatasets/topCreatives/signals itself first, independent
// of this call. The AI never receives raw Lead/Sale/AcquisitionEvent rows
// and is never asked to compute a rate, sum, or count — only to phrase an
// advisory summary of numbers that already exist. See
// ai-feedback-explanation-schema.ts for the structural + wording
// safeguards on what it's allowed to return.
export type AiFeedbackExplanationRequest = {
  topCampaigns: unknown;
  topDatasets: unknown;
  topCreatives: unknown;
  signals: unknown;
};

export interface AiProviderAdapter {
  readonly providerName: string;
  converse(request: AiConversationRequest): Promise<unknown>;
  // Returns Promise<unknown> for the same reason converse() does — the
  // caller (lead-classification-service.ts) always validates the result
  // against lead-classification-schema.ts before trusting it. Must never
  // return "new" or any value outside hot/warm/cold — classification is a
  // proposal; lead-classification-service.ts alone decides whether/how to
  // apply it to Lead.status.
  classifyLead(request: AiClassificationRequest): Promise<unknown>;
  // Returns Promise<unknown> — feedback-service.ts always validates the
  // result against ai-feedback-explanation-schema.ts, and treats any
  // failure (provider throws, or output fails validation) as "no
  // explanation available", never as a fatal error — the deterministic
  // Stage 11 output is always returned regardless of this call's outcome.
  explainFeedback(request: AiFeedbackExplanationRequest): Promise<unknown>;
}
