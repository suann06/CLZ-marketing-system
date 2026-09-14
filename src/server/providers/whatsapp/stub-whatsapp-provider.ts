import type {
  WhatsAppProviderAdapter,
  WhatsAppSendRequest,
  WhatsAppSendResult,
} from "@/server/providers/whatsapp/provider-adapter";

// Development-only simulated provider. This makes NO network call and
// NEVER contacts Meta, Twilio, or any real messaging platform. Every
// external ID it returns is prefixed "stub-", mirroring StubAdsProvider,
// so a simulated message can never be mistaken for a real one downstream.
export class StubWhatsAppProvider implements WhatsAppProviderAdapter {
  readonly providerName = "stub";

  async send(request: WhatsAppSendRequest): Promise<WhatsAppSendResult> {
    return {
      success: true,
      externalMessageId: `stub-message-${request.externalThreadId}-${Date.now()}`,
    };
  }
}
