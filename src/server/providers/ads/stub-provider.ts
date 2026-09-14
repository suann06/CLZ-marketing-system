import type { AdsProviderAdapter, LaunchRequest, LaunchResult } from "@/server/providers/ads/provider-adapter";

// Development-only simulated provider. This makes NO network call and
// NEVER publishes anything to a real advertising platform. Every external
// ID it returns is deliberately prefixed "stub-" so a simulated launch can
// never be mistaken for a real one anywhere downstream (database, UI,
// activity log). Do not remove this prefix without replacing this class
// with a real provider.
export class StubAdsProvider implements AdsProviderAdapter {
  readonly providerName = "stub";

  async launch(request: LaunchRequest): Promise<LaunchResult> {
    const suffix = `${request.campaignId.slice(0, 8)}-${request.platform}-${request.variantIndex}-${Date.now()}`;
    return {
      success: true,
      externalCampaignId: `stub-campaign-${suffix}`,
      externalAdId: `stub-ad-${suffix}`,
      externalCreativeId: `stub-creative-${suffix}`,
    };
  }
}
