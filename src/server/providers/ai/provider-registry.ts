import type { AiProviderAdapter } from "@/server/providers/ai/provider-adapter";
import { StubAiProvider } from "@/server/providers/ai/stub-ai-provider";

// Only StubAiProvider is implemented in Phase 3C. When a real provider
// exists, replacing this entry is the only change required;
// conversation-service.ts never changes. Mirrors
// src/server/providers/ads/provider-registry.ts and
// src/server/providers/whatsapp/provider-registry.ts.
const stubProvider = new StubAiProvider();

export function getAiProvider(): AiProviderAdapter {
  return stubProvider;
}
