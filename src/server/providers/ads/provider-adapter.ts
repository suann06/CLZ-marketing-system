import type { ContentVariant } from "@/server/ai/schemas/content-set-output";

// The seam between launch-service.ts and any actual ad platform. The
// service layer only ever depends on this interface — never on a concrete
// provider — so swapping StubAdsProvider for real MetaAdsProvider /
// TikTokAdsProvider later requires no change to the service, routes, or UI.

export type LaunchPlatformValue = "facebook" | "instagram" | "tiktok";

export type LaunchRequest = {
  campaignId: string;
  contentSetId: string;
  platform: LaunchPlatformValue;
  variantIndex: number;
  variant: ContentVariant;
};

export type LaunchResult =
  | {
      success: true;
      externalCampaignId: string;
      externalAdId: string;
      externalCreativeId?: string;
    }
  | {
      success: false;
      failureReason: string;
    };

export interface AdsProviderAdapter {
  readonly providerName: string;
  launch(request: LaunchRequest): Promise<LaunchResult>;
}
