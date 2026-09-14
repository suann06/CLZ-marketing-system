import { describe, expect, it, vi, beforeEach } from "vitest";
import { acquisitionClickSchema } from "@/server/validation/acquisition-schema";

// Prisma is fully mocked — never touches the real Supabase database. Note
// the mocked prisma client below deliberately exposes only
// `campaign.findUnique` and `acquisitionEvent.create` — no `lead`, no
// `whatsApp*` table exists anywhere in this mock (or in the schema at all).
// If this service ever tried to touch either, the call would throw "is not
// a function" and the relevant test would fail loudly — a structural
// guarantee, not just an assertion, that no Lead/WhatsApp record is ever
// created here.
const {
  campaignFindUnique,
  campaignDatasetFindUnique,
  launchFindUnique,
  acquisitionEventCreate,
  logActivityMock,
} = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  campaignDatasetFindUnique: vi.fn(),
  launchFindUnique: vi.fn(),
  acquisitionEventCreate: vi.fn(),
  logActivityMock: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    campaign: { findUnique: campaignFindUnique },
    campaignDataset: { findUnique: campaignDatasetFindUnique },
    launch: { findUnique: launchFindUnique },
    acquisitionEvent: { create: acquisitionEventCreate },
  },
}));

vi.mock("@/lib/actor", () => ({
  logActivity: logActivityMock,
}));

import {
  recordAcquisitionEvent,
  recordAcquisitionEventFromLaunch,
  InvalidAcquisitionAttributionError,
  LaunchNotFoundError,
} from "@/server/services/acquisition-service";
import { CampaignNotFoundError } from "@/server/services/campaign-service";

describe("acquisitionClickSchema", () => {
  it("rejects a missing campaignId", () => {
    expect(acquisitionClickSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-uuid campaignId", () => {
    expect(acquisitionClickSchema.safeParse({ campaignId: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects an empty-string attribution field", () => {
    expect(
      acquisitionClickSchema.safeParse({
        campaignId: "11111111-1111-4111-8111-111111111111",
        source: "",
      }).success,
    ).toBe(false);
  });

  it("accepts a valid minimal payload (campaignId only)", () => {
    expect(
      acquisitionClickSchema.safeParse({ campaignId: "11111111-1111-4111-8111-111111111111" }).success,
    ).toBe(true);
  });

  it("accepts a full valid payload", () => {
    expect(
      acquisitionClickSchema.safeParse({
        campaignId: "11111111-1111-4111-8111-111111111111",
        source: "facebook",
        medium: "cpc",
        campaign: "spring-promo",
        ref: "abc123",
      }).success,
    ).toBe(true);
  });

  it("accepts an optional datasetId/launchId", () => {
    expect(
      acquisitionClickSchema.safeParse({
        campaignId: "11111111-1111-4111-8111-111111111111",
        datasetId: "22222222-2222-4222-8222-222222222222",
        launchId: "33333333-3333-4333-8333-333333333333",
      }).success,
    ).toBe(true);
  });

  it("rejects a non-uuid datasetId/launchId", () => {
    expect(
      acquisitionClickSchema.safeParse({
        campaignId: "11111111-1111-4111-8111-111111111111",
        datasetId: "not-a-uuid",
      }).success,
    ).toBe(false);
    expect(
      acquisitionClickSchema.safeParse({
        campaignId: "11111111-1111-4111-8111-111111111111",
        launchId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });
});

describe("recordAcquisitionEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acquisitionEventCreate.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "event-1",
        createdAt: new Date(),
        ...data,
      }),
    );
  });

  it("creates an AcquisitionEvent for a valid campaign, preserving all attribution fields exactly", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });

    const event = await recordAcquisitionEvent({
      campaignId: "c1",
      source: "facebook",
      medium: "cpc",
      campaign: "spring-promo",
      ref: "abc123",
    });

    expect(acquisitionEventCreate).toHaveBeenCalledWith({
      data: {
        campaignId: "c1",
        source: "facebook",
        medium: "cpc",
        campaign: "spring-promo",
        ref: "abc123",
        datasetId: null,
        launchId: null,
      },
    });
    expect(event.campaignId).toBe("c1");
    expect(event.source).toBe("facebook");
    expect(event.medium).toBe("cpc");
    expect(event.campaign).toBe("spring-promo");
    expect(event.ref).toBe("abc123");
    expect(event.createdAt).toBeInstanceOf(Date);
  });

  it("stores null for omitted attribution fields rather than inventing or merging values", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });

    await recordAcquisitionEvent({ campaignId: "c1" });

    expect(acquisitionEventCreate).toHaveBeenCalledWith({
      data: {
        campaignId: "c1",
        source: null,
        medium: null,
        campaign: null,
        ref: null,
        datasetId: null,
        launchId: null,
      },
    });
  });

  it("persists a valid datasetId that is targeted by the campaign", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    campaignDatasetFindUnique.mockResolvedValue({ campaignId: "c1", datasetId: "d1" });

    await recordAcquisitionEvent({ campaignId: "c1", datasetId: "d1" });

    expect(campaignDatasetFindUnique).toHaveBeenCalledWith({
      where: { campaignId_datasetId: { campaignId: "c1", datasetId: "d1" } },
    });
    expect(acquisitionEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ datasetId: "d1" }) }),
    );
  });

  it("rejects a datasetId not targeted by the campaign", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    campaignDatasetFindUnique.mockResolvedValue(null);

    await expect(
      recordAcquisitionEvent({ campaignId: "c1", datasetId: "d-other" }),
    ).rejects.toBeInstanceOf(InvalidAcquisitionAttributionError);
    expect(acquisitionEventCreate).not.toHaveBeenCalled();
  });

  it("persists a valid launchId that belongs to the campaign", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    launchFindUnique.mockResolvedValue({ campaignId: "c1" });

    await recordAcquisitionEvent({ campaignId: "c1", launchId: "l1" });

    expect(launchFindUnique).toHaveBeenCalledWith({ where: { id: "l1" }, select: { campaignId: true } });
    expect(acquisitionEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ launchId: "l1" }) }),
    );
  });

  it("rejects a launchId that belongs to a different campaign", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    launchFindUnique.mockResolvedValue({ campaignId: "other-campaign" });

    await expect(
      recordAcquisitionEvent({ campaignId: "c1", launchId: "l-other" }),
    ).rejects.toBeInstanceOf(InvalidAcquisitionAttributionError);
    expect(acquisitionEventCreate).not.toHaveBeenCalled();
  });

  it("rejects a launchId that does not exist", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    launchFindUnique.mockResolvedValue(null);

    await expect(
      recordAcquisitionEvent({ campaignId: "c1", launchId: "missing" }),
    ).rejects.toBeInstanceOf(InvalidAcquisitionAttributionError);
    expect(acquisitionEventCreate).not.toHaveBeenCalled();
  });

  it("rejects a nonexistent campaignId and creates nothing", async () => {
    campaignFindUnique.mockResolvedValue(null);

    await expect(recordAcquisitionEvent({ campaignId: "missing" })).rejects.toBeInstanceOf(
      CampaignNotFoundError,
    );
    expect(acquisitionEventCreate).not.toHaveBeenCalled();
  });

  it("logs a system-attributed activity entry, never a human or AI one", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });

    await recordAcquisitionEvent({ campaignId: "c1", source: "facebook" });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "acquisition_event",
        action: "acquisition_event_recorded",
        actor: { type: "system", id: null },
      }),
    );
  });

  it("tags manually-attributed events as attributionSource: 'manual'", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });

    await recordAcquisitionEvent({ campaignId: "c1" });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ attributionSource: "manual" }) }),
    );
  });
});

describe("recordAcquisitionEventFromLaunch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acquisitionEventCreate.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "event-1",
        createdAt: new Date(),
        ...data,
      }),
    );
  });

  it("derives campaignId from the Launch — never from any client input", async () => {
    launchFindUnique.mockResolvedValue({ id: "l1", campaignId: "c1" });

    const event = await recordAcquisitionEventFromLaunch("l1", {});

    expect(acquisitionEventCreate).toHaveBeenCalledWith({
      data: {
        campaignId: "c1",
        source: null,
        medium: null,
        campaign: null,
        ref: null,
        datasetId: null,
        launchId: "l1",
      },
    });
    expect(event.campaignId).toBe("c1");
  });

  it("throws LaunchNotFoundError for a nonexistent launchId and creates nothing", async () => {
    launchFindUnique.mockResolvedValue(null);

    await expect(recordAcquisitionEventFromLaunch("missing", {})).rejects.toBeInstanceOf(
      LaunchNotFoundError,
    );
    expect(acquisitionEventCreate).not.toHaveBeenCalled();
  });

  it("accepts a datasetId that is targeted by the launch's own campaign", async () => {
    launchFindUnique.mockResolvedValue({ id: "l1", campaignId: "c1" });
    campaignDatasetFindUnique.mockResolvedValue({ campaignId: "c1", datasetId: "d1" });

    await recordAcquisitionEventFromLaunch("l1", { datasetId: "d1" });

    expect(campaignDatasetFindUnique).toHaveBeenCalledWith({
      where: { campaignId_datasetId: { campaignId: "c1", datasetId: "d1" } },
    });
    expect(acquisitionEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ datasetId: "d1" }) }),
    );
  });

  it("rejects a datasetId not targeted by the launch's own campaign (dataset/launch campaign mismatch)", async () => {
    launchFindUnique.mockResolvedValue({ id: "l1", campaignId: "c1" });
    campaignDatasetFindUnique.mockResolvedValue(null);

    await expect(
      recordAcquisitionEventFromLaunch("l1", { datasetId: "d-other" }),
    ).rejects.toBeInstanceOf(InvalidAcquisitionAttributionError);
    expect(acquisitionEventCreate).not.toHaveBeenCalled();
  });

  it("preserves source/medium/campaign/ref exactly", async () => {
    launchFindUnique.mockResolvedValue({ id: "l1", campaignId: "c1" });

    await recordAcquisitionEventFromLaunch("l1", {
      source: "facebook",
      medium: "cpc",
      campaign: "spring-promo",
      ref: "abc123",
    });

    expect(acquisitionEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "facebook",
          medium: "cpc",
          campaign: "spring-promo",
          ref: "abc123",
        }),
      }),
    );
  });

  it("tags launch-tracking-link events as attributionSource: 'launch_tracking_link'", async () => {
    launchFindUnique.mockResolvedValue({ id: "l1", campaignId: "c1" });

    await recordAcquisitionEventFromLaunch("l1", {});

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ attributionSource: "launch_tracking_link" }),
      }),
    );
  });
});
