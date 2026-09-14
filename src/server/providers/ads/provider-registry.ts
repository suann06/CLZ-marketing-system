import type { AdsProviderAdapter, LaunchPlatformValue } from "@/server/providers/ads/provider-adapter";
import { StubAdsProvider } from "@/server/providers/ads/stub-provider";

// facebook/instagram both route through the same Meta provider slot (one
// Business Manager, one access token, one ad account in reality); tiktok
// has its own slot. Only StubAdsProvider is implemented in Phase 2D — when
// real credentials exist, replacing these two entries with
// `new MetaAdsProvider(...)` / `new TikTokAdsProvider(...)` is the ONLY
// change required; launch-service.ts never changes.
const stubProvider = new StubAdsProvider();

const PROVIDER_BY_PLATFORM: Record<LaunchPlatformValue, AdsProviderAdapter> = {
  facebook: stubProvider,
  instagram: stubProvider,
  tiktok: stubProvider,
};

export function getProviderForPlatform(platform: LaunchPlatformValue): AdsProviderAdapter {
  return PROVIDER_BY_PLATFORM[platform];
}
