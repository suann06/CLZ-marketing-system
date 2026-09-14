import type {
  AiProviderAdapter,
  AiConversationRequest,
  AiCustomerInfo,
} from "@/server/providers/ai/provider-adapter";

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
}
