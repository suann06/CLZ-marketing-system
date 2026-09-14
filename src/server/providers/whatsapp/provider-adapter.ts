// The seam between whatsapp-service.ts and any actual messaging platform.
// Mirrors src/server/providers/ads/provider-adapter.ts exactly: the service
// layer only ever depends on this interface — never on a concrete provider
// — so swapping StubWhatsAppProvider for a real MetaWhatsAppProvider later
// requires no change to the service, routes, or webhook.
//
// Phase 3B has no outbound-send code path — this interface exists so the
// provider registry has a real seam, not because anything calls send() yet.

export type WhatsAppSendRequest = {
  externalThreadId: string;
  content: string;
};

export type WhatsAppSendResult =
  | {
      success: true;
      externalMessageId: string;
    }
  | {
      success: false;
      failureReason: string;
    };

export interface WhatsAppProviderAdapter {
  readonly providerName: string;
  send(request: WhatsAppSendRequest): Promise<WhatsAppSendResult>;
}
