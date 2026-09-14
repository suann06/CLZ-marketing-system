import { describe, expect, it, vi, beforeEach } from "vitest";
import { LaunchStatus, ContentSetStatus } from "@prisma/client";

// Prisma AND the ads provider are both fully mocked — these tests never
// touch the real Supabase database or any real Meta/TikTok API. Note that
// the mocked `campaign`/`contentSet` objects below deliberately expose only
// findUnique/findFirst (no create/update) — if launch-service.ts ever tried
// to mutate either, the test would fail loudly with "is not a function",
// which is itself a safeguard proving Campaign/ContentSet are never written
// to by this service.
const {
  campaignFindUnique,
  contentSetFindFirst,
  launchFindFirst,
  launchFindMany,
  launchCreate,
  launchUpdate,
  logActivityMock,
  providerLaunchMock,
} = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  contentSetFindFirst: vi.fn(),
  launchFindFirst: vi.fn(),
  launchFindMany: vi.fn(),
  launchCreate: vi.fn(),
  launchUpdate: vi.fn(),
  logActivityMock: vi.fn(),
  providerLaunchMock: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    campaign: { findUnique: campaignFindUnique },
    contentSet: { findFirst: contentSetFindFirst },
    launch: {
      findFirst: launchFindFirst,
      findMany: launchFindMany,
      create: launchCreate,
      update: launchUpdate,
    },
  },
}));

vi.mock("@/lib/actor", () => ({
  logActivity: logActivityMock,
}));

vi.mock("@/server/providers/ads/provider-registry", () => ({
  getProviderForPlatform: () => ({
    providerName: "stub",
    launch: providerLaunchMock,
  }),
}));

import { requestLaunch, getLaunchesForCampaign, LaunchValidationError } from "@/server/services/launch-service";
import { CampaignNotFoundError } from "@/server/services/campaign-service";
import { ContentSetNotApprovedError } from "@/server/services/content-generation-service";
import type { ContentSetOutput } from "@/server/ai/schemas/content-set-output";

const validContent: ContentSetOutput = {
  facebook: [
    { variantLabel: "A", headline: "Fast fiber", bodyText: "Get 100Mbps.", cta: "Sign up" },
    { variantLabel: "B", headline: "Reliable fiber", bodyText: "Always on.", cta: "Learn more" },
  ],
  instagram: [{ variantLabel: "A", headline: "Fiber that flies", bodyText: "Zero lag.", cta: "Learn more" }],
  tiktok: [{ variantLabel: "A", headline: "Speed run", bodyText: "100Mbps now.", cta: "Get it" }],
  whatsapp: [{ variantLabel: "A", headline: "Upgrade", bodyText: "100Mbps available.", cta: "Reply YES" }],
};

function setupApprovedContentSet(overrides: Record<string, unknown> = {}) {
  campaignFindUnique.mockResolvedValue({ id: "c1" });
  contentSetFindFirst.mockResolvedValue({
    id: "content-1",
    campaignId: "c1",
    version: 3,
    status: ContentSetStatus.approved,
    content: validContent,
    ...overrides,
  });
}

const actor = { type: "human" as const, id: "user-1" };

describe("requestLaunch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    launchCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "launch-1",
      ...data,
    }));
    launchUpdate.mockImplementation(
      async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: where.id,
        campaignId: "c1",
        ...data,
      }),
    );
  });

  it("rejects whatsapp as a launch platform", async () => {
    setupApprovedContentSet();
    await expect(requestLaunch("c1", "whatsapp", 0, actor)).rejects.toBeInstanceOf(LaunchValidationError);
    expect(providerLaunchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid platform string", async () => {
    setupApprovedContentSet();
    await expect(requestLaunch("c1", "linkedin", 0, actor)).rejects.toBeInstanceOf(LaunchValidationError);
  });

  it("rejects an out-of-range variant index", async () => {
    setupApprovedContentSet();
    await expect(requestLaunch("c1", "facebook", 99, actor)).rejects.toBeInstanceOf(LaunchValidationError);
    expect(providerLaunchMock).not.toHaveBeenCalled();
  });

  it("requires an approved content set", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    contentSetFindFirst.mockResolvedValue(null);
    await expect(requestLaunch("c1", "facebook", 0, actor)).rejects.toBeInstanceOf(ContentSetNotApprovedError);
  });

  it("requires an existing campaign", async () => {
    campaignFindUnique.mockResolvedValue(null);
    await expect(requestLaunch("missing", "facebook", 0, actor)).rejects.toBeInstanceOf(CampaignNotFoundError);
  });

  it("creates a launch with correct linkage and a full selectedVariant snapshot, then records provider success as live", async () => {
    setupApprovedContentSet();
    launchFindFirst.mockResolvedValue(null);
    providerLaunchMock.mockResolvedValue({
      success: true,
      externalCampaignId: "stub-campaign-1",
      externalAdId: "stub-ad-1",
      externalCreativeId: "stub-creative-1",
    });

    const result = await requestLaunch("c1", "facebook", 0, actor);

    expect(launchCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: "c1",
        contentSetId: "content-1",
        contentSetVersion: 3,
        platform: "facebook",
        variantIndex: 0,
        selectedVariant: validContent.facebook[0],
        status: LaunchStatus.pending,
        idempotencyKey: "c1:content-1:facebook:0",
        createdById: actor.id,
      }),
    });

    // First update: persisted as "launching" BEFORE the provider call.
    expect(launchUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "launch-1" },
      data: { status: LaunchStatus.launching, provider: "stub" },
    });
    // Second update: provider succeeded.
    expect(launchUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "launch-1" },
      data: expect.objectContaining({
        status: LaunchStatus.live,
        externalCampaignId: "stub-campaign-1",
        externalAdId: "stub-ad-1",
        externalCreativeId: "stub-creative-1",
        launchedAt: expect.any(Date),
      }),
    });

    expect(result.status).toBe(LaunchStatus.live);
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "launch_requested", actor, entityType: "launch" }),
    );
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "launch_succeeded",
        actor: { type: "system", id: null },
        entityType: "launch",
      }),
    );
  });

  it("records a clean provider failure as failed with failureReason", async () => {
    setupApprovedContentSet();
    launchFindFirst.mockResolvedValue(null);
    providerLaunchMock.mockResolvedValue({ success: false, failureReason: "Ad account restricted." });

    const result = await requestLaunch("c1", "facebook", 0, actor);

    expect(result.status).toBe(LaunchStatus.failed);
    expect(launchUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "launch-1" },
      data: { status: LaunchStatus.failed, failureReason: "Ad account restricted." },
    });
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "launch_failed",
        actor: { type: "system", id: null },
      }),
    );
  });

  it("treats a thrown provider exception the same as a clean failure", async () => {
    setupApprovedContentSet();
    launchFindFirst.mockResolvedValue(null);
    providerLaunchMock.mockRejectedValue(new Error("simulated network error"));

    const result = await requestLaunch("c1", "facebook", 0, actor);

    expect(result.status).toBe(LaunchStatus.failed);
    expect(launchUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "launch-1" },
      data: { status: LaunchStatus.failed, failureReason: "simulated network error" },
    });
  });

  it("returns an existing in-progress launch without calling the provider again (idempotency)", async () => {
    setupApprovedContentSet();
    launchFindFirst.mockResolvedValue({ id: "existing-launch", status: LaunchStatus.launching });

    const result = await requestLaunch("c1", "facebook", 0, actor);

    expect(result).toMatchObject({ id: "existing-launch", status: LaunchStatus.launching });
    expect(providerLaunchMock).not.toHaveBeenCalled();
    expect(launchCreate).not.toHaveBeenCalled();
  });

  it("returns an existing live launch without calling the provider again (idempotency)", async () => {
    setupApprovedContentSet();
    launchFindFirst.mockResolvedValue({ id: "existing-launch", status: LaunchStatus.live });

    const result = await requestLaunch("c1", "facebook", 0, actor);

    expect(result).toMatchObject({ id: "existing-launch", status: LaunchStatus.live });
    expect(providerLaunchMock).not.toHaveBeenCalled();
  });

  it("does not let a previously failed attempt block a fresh retry, and creates a new row", async () => {
    setupApprovedContentSet();
    // The idempotency lookup only matches pending/launching/live — a failed
    // attempt is correctly excluded, so it resolves to null here.
    launchFindFirst.mockResolvedValue(null);
    providerLaunchMock.mockResolvedValue({
      success: true,
      externalCampaignId: "stub-campaign-2",
      externalAdId: "stub-ad-2",
    });

    await requestLaunch("c1", "facebook", 0, actor);

    expect(launchFindFirst).toHaveBeenCalledWith({
      where: {
        idempotencyKey: "c1:content-1:facebook:0",
        status: { in: [LaunchStatus.pending, LaunchStatus.launching, LaunchStatus.live] },
      },
      orderBy: { createdAt: "desc" },
    });
    expect(launchCreate).toHaveBeenCalledTimes(1);
  });
});

describe("getLaunchesForCampaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns launches for the campaign", async () => {
    launchFindMany.mockResolvedValue([{ id: "l1" }]);

    const result = await getLaunchesForCampaign("c1");

    expect(launchFindMany).toHaveBeenCalledWith({
      where: { campaignId: "c1" },
      orderBy: [{ platform: "asc" }, { createdAt: "desc" }],
    });
    expect(result).toEqual([{ id: "l1" }]);
  });
});
