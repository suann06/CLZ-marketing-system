import type {
  AiProviderAdapter,
  AiConversationRequest,
  AiClassificationRequest,
  AiCustomerInfo,
} from "@/server/providers/ai/provider-adapter";

// Deliberately simple, deterministic keyword matching — a real provider
// would use an LLM; this stub only needs to produce a valid, testable
// hot/warm/cold proposal from the conversation text it's given, never
// inventing facts beyond what appears in recentMessages. Checked in
// priority order: an explicit statement of disinterest (COLD) or of
// readiness to proceed (HOT) is a stronger signal than general product
// interest (WARM), which is the fallback once any keyword-bearing message
// exists at all (lead-classification-service.ts only calls classifyLead()
// once it has already decided there is *some* signal worth classifying).
const HOT_KEYWORDS = [
  "apply",
  "sign up",
  "signup",
  "proceed",
  "purchase",
  "buy now",
  "register",
  "agent",
  "get started",
  "ready to",
];

const COLD_KEYWORDS = [
  "not interested",
  "no thanks",
  "not now",
  "don't need",
  "do not need",
  "no need",
  "not needed",
  "stop messaging",
];

const WARM_KEYWORDS = [
  "price",
  "pricing",
  "cost",
  "how much",
  "coverage",
  "package",
  "compare",
  "details",
  "tell me more",
  "interested",
];

// Development-only simulated provider. Makes NO network call and NEVER
// contacts Anthropic or any real AI backend. Deterministic: given the same
// request it always produces the same shape of response, which keeps
// Phase 3C's local end-to-end simulation reproducible.
//
// Never returns hot/warm/cold or any classification field — only the
// name/location/currentProvider/interest fields defined by AiCustomerInfo.
// Never invents campaign facts: the reply only ever references
// campaign.productPromotion, which is passed in exactly as stored.
export class StubAiProvider implements AiProviderAdapter {
  readonly providerName = "stub";

  async converse(request: AiConversationRequest): Promise<unknown> {
    const { customerInfo, campaign } = request;

    const nextQuestionField = this.pickMissingField(customerInfo);
    const response = this.buildResponse(campaign.productPromotion, nextQuestionField);

    return {
      response,
      // Echoes back exactly what it was given — a stub has no real
      // extraction capability. conversation-service.ts's merge logic is
      // what actually preserves/combines customer information across
      // turns; this provider never invents or discards a value itself.
      customerInfo: {
        name: customerInfo.name ?? null,
        location: customerInfo.location ?? null,
        currentProvider: customerInfo.currentProvider ?? null,
        interest: customerInfo.interest ?? null,
      } satisfies AiCustomerInfo,
    };
  }

  private pickMissingField(customerInfo: AiCustomerInfo): keyof AiCustomerInfo | null {
    if (!customerInfo.location) return "location";
    if (!customerInfo.interest) return "interest";
    return null;
  }

  private buildResponse(productPromotion: string, missingField: keyof AiCustomerInfo | null): string {
    if (missingField === "location") {
      return `Thanks for reaching out about ${productPromotion}! May I know which area you're staying in?`;
    }
    if (missingField === "interest") {
      return `Got it, thanks! What would you like to know more about — pricing, coverage, or something else?`;
    }
    return `Thanks for your message! Our team will follow up shortly with more details about ${productPromotion}.`;
  }

  // Returns only hot/warm/cold + a factual reason, grounded in whichever
  // keyword(s) matched — never invents intent the conversation doesn't
  // contain. Makes no network call.
  async classifyLead(request: AiClassificationRequest): Promise<unknown> {
    const inboundText = request.recentMessages
      .filter((m) => m.direction === "inbound")
      .map((m) => m.content.toLowerCase())
      .join(" \n ");

    const hotMatch = HOT_KEYWORDS.find((kw) => inboundText.includes(kw));
    if (hotMatch) {
      return {
        classification: "hot",
        reason: `Customer's message included "${hotMatch}", indicating readiness to proceed.`,
      };
    }

    const coldMatch = COLD_KEYWORDS.find((kw) => inboundText.includes(kw));
    if (coldMatch) {
      return {
        classification: "cold",
        reason: `Customer's message included "${coldMatch}", indicating a lack of interest.`,
      };
    }

    const warmMatch = WARM_KEYWORDS.find((kw) => inboundText.includes(kw));
    if (warmMatch) {
      return {
        classification: "warm",
        reason: `Customer's message included "${warmMatch}", indicating product interest without a stated decision to proceed.`,
      };
    }

    return {
      classification: "warm",
      reason: "Customer engaged with a non-trivial message but did not state a clear decision to proceed or decline.",
    };
  }
}
