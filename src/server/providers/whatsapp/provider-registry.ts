import type { WhatsAppProviderAdapter } from "@/server/providers/whatsapp/provider-adapter";
import { StubWhatsAppProvider } from "@/server/providers/whatsapp/stub-whatsapp-provider";

// Only StubWhatsAppProvider is implemented in Phase 3B. When real
// credentials exist, replacing this entry with `new MetaWhatsAppProvider(...)`
// is the only change required; whatsapp-service.ts never changes. Mirrors
// src/server/providers/ads/provider-registry.ts.
const stubProvider = new StubWhatsAppProvider();

export function getWhatsAppProvider(): WhatsAppProviderAdapter {
  return stubProvider;
}
