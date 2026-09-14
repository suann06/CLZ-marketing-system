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
const { campaignFindUnique, acquisitionEventCreate, logActivityMock } = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  acquisitionEventCreate: vi.fn(),
  logActivityMock: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    campaign: { findUnique: campaignFindUnique },
    acquisitionEvent: { create: acquisitionEventCreate },
  },
}));

vi.mock("@/lib/actor", () => ({
  logActivity: logActivityMock,
}));

import { recordAcquisitionEvent } from "@/server/services/acquisition-service";
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
      data: { campaignId: "c1", source: null, medium: null, campaign: null, ref: null },
    });
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
});
