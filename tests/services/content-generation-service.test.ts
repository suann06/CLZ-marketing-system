import { describe, expect, it, vi, beforeEach } from "vitest";
import { ContentSetStatus, MarketingStrategyStatus, CampaignStatus } from "@prisma/client";

// Prisma AND the Anthropic provider are both fully mocked — these tests
// never touch the real Supabase database or the real Anthropic API.
// campaign-service.ts and marketing-strategy-service.ts run for real
// against this mocked Prisma client, giving integration-style coverage of
// the approved-strategy guard being wired correctly, without ever hitting
// a live database.
const {
  campaignFindUnique,
  campaignDatasetFindMany,
  campaignBuildingFindMany,
  marketingStrategyFindFirst,
  contentSetFindFirst,
  contentSetFindUnique,
  contentSetCreate,
  contentSetUpdate,
  contentSetUpdateMany,
  logActivityMock,
  generateStructuredCompletionMock,
} = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  campaignDatasetFindMany: vi.fn(),
  campaignBuildingFindMany: vi.fn(),
  marketingStrategyFindFirst: vi.fn(),
  contentSetFindFirst: vi.fn(),
  contentSetFindUnique: vi.fn(),
  contentSetCreate: vi.fn(),
  contentSetUpdate: vi.fn(),
  contentSetUpdateMany: vi.fn(),
  logActivityMock: vi.fn(),
  generateStructuredCompletionMock: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    campaign: { findUnique: campaignFindUnique },
    campaignDataset: { findMany: campaignDatasetFindMany },
    campaignBuilding: { findMany: campaignBuildingFindMany },
    marketingStrategy: { findFirst: marketingStrategyFindFirst },
    contentSet: {
      findFirst: contentSetFindFirst,
      findUnique: contentSetFindUnique,
      create: contentSetCreate,
      update: contentSetUpdate,
      updateMany: contentSetUpdateMany,
    },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        contentSet: {
          create: contentSetCreate,
          update: contentSetUpdate,
          updateMany: contentSetUpdateMany,
        },
      }),
  },
}));

vi.mock("@/lib/actor", () => ({
  logActivity: logActivityMock,
}));

vi.mock("@/server/ai/anthropic-client", async () => {
  const actual = await vi.importActual<typeof import("@/server/ai/anthropic-client")>(
    "@/server/ai/anthropic-client",
  );
  return {
    ...actual,
    generateStructuredCompletion: generateStructuredCompletionMock,
  };
});

import {
  generateContentSet,
  getLatestContentSet,
  editContentSet,
  approveContentSet,
  getApprovedContentSet,
  ContentGenerationError,
  ContentSetNotFoundError,
  ContentSetNotEditableError,
  ContentSetContentInvalidError,
  ContentSetNotApprovedError,
} from "@/server/services/content-generation-service";
import { AiProviderError } from "@/server/ai/anthropic-client";
import { CampaignNotFoundError } from "@/server/services/campaign-service";
import { MarketingStrategyNotApprovedError } from "@/server/services/marketing-strategy-service";
import type { ContentSetOutput } from "@/server/ai/schemas/content-set-output";

const validOutput: ContentSetOutput = {
  facebook: [
    { variantLabel: "Speed", headline: "Blazing fast fiber", bodyText: "Get 100Mbps today.", cta: "Sign up" },
  ],
  instagram: [
    { variantLabel: "Speed", headline: "Fiber that flies", bodyText: "100Mbps, zero lag.", cta: "Learn more" },
  ],
  tiktok: [{ variantLabel: "Speed", headline: "Speed run your internet", bodyText: "100Mbps now.", cta: "Get it" }],
  whatsapp: [
    { variantLabel: "Speed", headline: "Upgrade your internet", bodyText: "100Mbps fiber available.", cta: "Reply YES" },
  ],
};

const approvedStrategyContent = {
  targetAudience: { description: "Urban professionals", segments: ["Young professionals"] },
  customerNeeds: ["Reliable internet"],
  positioning: "Fast and reliable fiber for CBD professionals.",
  marketingAngles: ["Speed matters"],
  messagingPillars: [{ title: "Reliability", description: "Always on." }],
  platformDirection: [{ platform: "facebook", direction: "Highlight speed." }],
  cta: "Sign up today",
};

function setupConfirmedCampaignWithApprovedStrategy() {
  campaignFindUnique.mockResolvedValue({
    id: "c1",
    status: CampaignStatus.confirmed,
    productPromotion: "Fiber 100Mbps",
    officialPricing: { amount: 99, currency: "MYR" },
    differentiators: ["Free install"],
  });
  campaignDatasetFindMany.mockResolvedValue([
    {
      campaignId: "c1",
      datasetId: "d1",
      dataset: { id: "d1", name: "CBD", sourceFilename: "cbd.xlsx", rowCount: 2 },
    },
  ]);
  campaignBuildingFindMany.mockResolvedValue([
    {
      campaignId: "c1",
      datasetId: "d1",
      buildingId: "b1",
      building: { id: "b1", name: "A", address: null, lat: null, lng: null, rawAttributes: {} },
    },
  ]);
  marketingStrategyFindFirst.mockResolvedValue({
    id: "strategy-1",
    campaignId: "c1",
    status: MarketingStrategyStatus.approved,
    content: approvedStrategyContent,
  });
}

const actor = { type: "human" as const, id: "user-1" };

describe("generateContentSet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contentSetCreate.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({ id: "content-1", ...data }),
    );
  });

  it("generates and persists a valid content set as version 1, linked to the approved strategy", async () => {
    setupConfirmedCampaignWithApprovedStrategy();
    contentSetFindFirst.mockResolvedValue(null);
    generateStructuredCompletionMock.mockResolvedValue(JSON.stringify(validOutput));

    const contentSet = await generateContentSet("c1", actor);

    expect(generateStructuredCompletionMock).toHaveBeenCalledTimes(1);
    expect(contentSetCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: "c1",
        marketingStrategyId: "strategy-1",
        version: 1,
        status: ContentSetStatus.draft,
        generatedById: actor.id,
      }),
    });
    expect(contentSet).toMatchObject({ campaignId: "c1", marketingStrategyId: "strategy-1", version: 1 });
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "content_generated", actor: { type: "ai", id: null } }),
    );
  });

  it("refuses generation when the campaign has no approved strategy", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1", status: CampaignStatus.confirmed });
    marketingStrategyFindFirst.mockResolvedValue(null);

    await expect(generateContentSet("c1", actor)).rejects.toBeInstanceOf(MarketingStrategyNotApprovedError);
    expect(generateStructuredCompletionMock).not.toHaveBeenCalled();
    expect(contentSetCreate).not.toHaveBeenCalled();
  });

  it("refuses generation for a nonexistent campaign", async () => {
    campaignFindUnique.mockResolvedValue(null);

    await expect(generateContentSet("missing", actor)).rejects.toBeInstanceOf(CampaignNotFoundError);
    expect(generateStructuredCompletionMock).not.toHaveBeenCalled();
  });

  it("archives the previous draft and creates version 2 on regeneration", async () => {
    setupConfirmedCampaignWithApprovedStrategy();
    contentSetFindFirst.mockResolvedValue({ id: "content-1", version: 1, status: ContentSetStatus.draft });
    generateStructuredCompletionMock.mockResolvedValue(JSON.stringify(validOutput));

    const contentSet = await generateContentSet("c1", actor);

    expect(contentSetUpdate).toHaveBeenCalledWith({
      where: { id: "content-1" },
      data: { status: ContentSetStatus.archived },
    });
    expect(contentSet.version).toBe(2);
  });

  it("leaves a previously approved content set untouched on regeneration", async () => {
    setupConfirmedCampaignWithApprovedStrategy();
    contentSetFindFirst.mockResolvedValue({ id: "content-1", version: 1, status: ContentSetStatus.approved });
    generateStructuredCompletionMock.mockResolvedValue(JSON.stringify(validOutput));

    const contentSet = await generateContentSet("c1", actor);

    expect(contentSetUpdate).not.toHaveBeenCalled();
    expect(contentSet.version).toBe(2);
  });

  it("retries once on malformed JSON, then succeeds", async () => {
    setupConfirmedCampaignWithApprovedStrategy();
    contentSetFindFirst.mockResolvedValue(null);
    generateStructuredCompletionMock
      .mockResolvedValueOnce("not json")
      .mockResolvedValueOnce(JSON.stringify(validOutput));

    const contentSet = await generateContentSet("c1", actor);

    expect(generateStructuredCompletionMock).toHaveBeenCalledTimes(2);
    expect(contentSet.version).toBe(1);
  });

  it("retries once on Zod validation failure, then succeeds", async () => {
    setupConfirmedCampaignWithApprovedStrategy();
    contentSetFindFirst.mockResolvedValue(null);
    generateStructuredCompletionMock
      .mockResolvedValueOnce(JSON.stringify({ facebook: [] })) // missing required platforms/fields
      .mockResolvedValueOnce(JSON.stringify(validOutput));

    const contentSet = await generateContentSet("c1", actor);

    expect(generateStructuredCompletionMock).toHaveBeenCalledTimes(2);
    expect(contentSet.version).toBe(1);
  });

  it("throws ContentGenerationError after 2 invalid attempts, logs a failure, and creates nothing", async () => {
    setupConfirmedCampaignWithApprovedStrategy();
    contentSetFindFirst.mockResolvedValue(null);
    generateStructuredCompletionMock.mockResolvedValue("still not json");

    await expect(generateContentSet("c1", actor)).rejects.toBeInstanceOf(ContentGenerationError);

    expect(generateStructuredCompletionMock).toHaveBeenCalledTimes(2);
    expect(contentSetCreate).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "content_generation_failed", actor: { type: "ai", id: null } }),
    );
  });

  it("does not retry a non-retryable provider error", async () => {
    setupConfirmedCampaignWithApprovedStrategy();
    contentSetFindFirst.mockResolvedValue(null);
    generateStructuredCompletionMock.mockRejectedValue(new AiProviderError("bad request", false));

    await expect(generateContentSet("c1", actor)).rejects.toBeInstanceOf(ContentGenerationError);
    expect(generateStructuredCompletionMock).toHaveBeenCalledTimes(1);
  });

  it("retries a retryable provider error once and succeeds", async () => {
    setupConfirmedCampaignWithApprovedStrategy();
    contentSetFindFirst.mockResolvedValue(null);
    generateStructuredCompletionMock
      .mockRejectedValueOnce(new AiProviderError("rate limited", true))
      .mockResolvedValueOnce(JSON.stringify(validOutput));

    const contentSet = await generateContentSet("c1", actor);

    expect(generateStructuredCompletionMock).toHaveBeenCalledTimes(2);
    expect(contentSet.version).toBe(1);
  });
});

describe("getLatestContentSet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws CampaignNotFoundError for a nonexistent campaign", async () => {
    campaignFindUnique.mockResolvedValue(null);
    await expect(getLatestContentSet("missing")).rejects.toBeInstanceOf(CampaignNotFoundError);
  });

  it("throws ContentSetNotFoundError when no content set exists yet", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    contentSetFindFirst.mockResolvedValue(null);
    await expect(getLatestContentSet("c1")).rejects.toBeInstanceOf(ContentSetNotFoundError);
  });

  it("returns the latest content set", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    contentSetFindFirst.mockResolvedValue({ id: "content-1", version: 3 });
    const result = await getLatestContentSet("c1");
    expect(result).toMatchObject({ id: "content-1", version: 3 });
  });
});

describe("editContentSet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contentSetCreate.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({ id: "content-2", ...data }),
    );
  });

  it("allows editing the current draft, archiving it and creating the next version", async () => {
    contentSetFindUnique.mockResolvedValue({
      id: "content-1",
      campaignId: "c1",
      marketingStrategyId: "strategy-1",
      version: 1,
      status: ContentSetStatus.draft,
      inputSnapshot: { productPromotion: "Fiber 100Mbps" },
    });
    contentSetFindFirst.mockResolvedValue({ id: "content-1" });

    const edited: ContentSetOutput = { ...validOutput, facebook: [{ ...validOutput.facebook[0], cta: "Call now" }] };
    const result = await editContentSet("c1", "content-1", edited, actor);

    expect(contentSetUpdate).toHaveBeenCalledWith({
      where: { id: "content-1" },
      data: { status: ContentSetStatus.archived },
    });
    expect(contentSetCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: "c1",
        marketingStrategyId: "strategy-1",
        version: 2,
        status: ContentSetStatus.draft,
        generatedById: actor.id,
      }),
    });
    expect(result.version).toBe(2);
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "content_edited", actor }),
    );
  });

  it("preserves marketingStrategyId unchanged from the edited version (never re-derived by editing)", async () => {
    contentSetFindUnique.mockResolvedValue({
      id: "content-1",
      campaignId: "c1",
      marketingStrategyId: "strategy-original",
      version: 1,
      status: ContentSetStatus.draft,
      inputSnapshot: {},
    });
    contentSetFindFirst.mockResolvedValue({ id: "content-1" });

    await editContentSet("c1", "content-1", validOutput, actor);

    expect(contentSetCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ marketingStrategyId: "strategy-original" }),
    });
  });

  it("carries the original inputSnapshot over unchanged", async () => {
    contentSetFindUnique.mockResolvedValue({
      id: "content-1",
      campaignId: "c1",
      marketingStrategyId: "strategy-1",
      version: 1,
      status: ContentSetStatus.draft,
      inputSnapshot: { productPromotion: "Original Snapshot" },
    });
    contentSetFindFirst.mockResolvedValue({ id: "content-1" });

    await editContentSet("c1", "content-1", validOutput, actor);

    expect(contentSetCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ inputSnapshot: { productPromotion: "Original Snapshot" } }),
    });
  });

  it("throws ContentSetNotFoundError when the content set does not exist", async () => {
    contentSetFindUnique.mockResolvedValue(null);
    await expect(editContentSet("c1", "missing", validOutput, actor)).rejects.toBeInstanceOf(
      ContentSetNotFoundError,
    );
  });

  it("throws ContentSetNotFoundError when the content set belongs to a different campaign", async () => {
    contentSetFindUnique.mockResolvedValue({
      id: "content-1",
      campaignId: "other-campaign",
      version: 1,
      status: ContentSetStatus.draft,
    });
    await expect(editContentSet("c1", "content-1", validOutput, actor)).rejects.toBeInstanceOf(
      ContentSetNotFoundError,
    );
  });

  it("rejects editing an archived content set", async () => {
    contentSetFindUnique.mockResolvedValue({
      id: "content-1",
      campaignId: "c1",
      version: 1,
      status: ContentSetStatus.archived,
    });
    contentSetFindFirst.mockResolvedValue({ id: "content-1" });

    await expect(editContentSet("c1", "content-1", validOutput, actor)).rejects.toBeInstanceOf(
      ContentSetNotEditableError,
    );
    expect(contentSetCreate).not.toHaveBeenCalled();
  });

  it("rejects editing an approved content set directly", async () => {
    contentSetFindUnique.mockResolvedValue({
      id: "content-1",
      campaignId: "c1",
      version: 1,
      status: ContentSetStatus.approved,
    });
    contentSetFindFirst.mockResolvedValue({ id: "content-1" });

    await expect(editContentSet("c1", "content-1", validOutput, actor)).rejects.toBeInstanceOf(
      ContentSetNotEditableError,
    );
    expect(contentSetCreate).not.toHaveBeenCalled();
  });

  it("rejects editing a stale draft that has already been superseded", async () => {
    contentSetFindUnique.mockResolvedValue({
      id: "content-1",
      campaignId: "c1",
      version: 1,
      status: ContentSetStatus.draft,
    });
    // A newer version already exists — content-1 is stale even though its
    // own status still (momentarily) says draft.
    contentSetFindFirst.mockResolvedValue({ id: "content-2" });

    await expect(editContentSet("c1", "content-1", validOutput, actor)).rejects.toBeInstanceOf(
      ContentSetNotEditableError,
    );
  });
});

describe("approveContentSet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contentSetUpdate.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "content-1",
        campaignId: "c1",
        version: 1,
        ...data,
      }),
    );
  });

  it("approves a draft content set and records approvedById/approvedAt", async () => {
    contentSetFindUnique.mockResolvedValue({
      id: "content-1",
      campaignId: "c1",
      version: 1,
      status: ContentSetStatus.draft,
      content: validOutput,
    });

    const result = await approveContentSet("c1", "content-1", actor);

    expect(contentSetUpdate).toHaveBeenCalledWith({
      where: { id: "content-1" },
      data: expect.objectContaining({
        status: ContentSetStatus.approved,
        approvedById: actor.id,
        approvedAt: expect.any(Date),
      }),
    });
    expect(result.status).toBe(ContentSetStatus.approved);
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "content_approved", actor }),
    );
  });

  it("archives the previously approved content set atomically", async () => {
    contentSetFindUnique.mockResolvedValue({
      id: "content-2",
      campaignId: "c1",
      version: 2,
      status: ContentSetStatus.draft,
      content: validOutput,
    });

    await approveContentSet("c1", "content-2", actor);

    expect(contentSetUpdateMany).toHaveBeenCalledWith({
      where: { campaignId: "c1", status: ContentSetStatus.approved },
      data: { status: ContentSetStatus.archived },
    });
  });

  it("rejects approving an archived content set", async () => {
    contentSetFindUnique.mockResolvedValue({
      id: "content-1",
      campaignId: "c1",
      version: 1,
      status: ContentSetStatus.archived,
      content: validOutput,
    });

    await expect(approveContentSet("c1", "content-1", actor)).rejects.toBeInstanceOf(
      ContentSetNotEditableError,
    );
  });

  it("rejects approving an already-approved content set", async () => {
    contentSetFindUnique.mockResolvedValue({
      id: "content-1",
      campaignId: "c1",
      version: 1,
      status: ContentSetStatus.approved,
      content: validOutput,
    });

    await expect(approveContentSet("c1", "content-1", actor)).rejects.toBeInstanceOf(
      ContentSetNotEditableError,
    );
  });

  it("throws ContentSetNotFoundError when the content set belongs to a different campaign", async () => {
    contentSetFindUnique.mockResolvedValue({
      id: "content-1",
      campaignId: "other-campaign",
      version: 1,
      status: ContentSetStatus.draft,
      content: validOutput,
    });

    await expect(approveContentSet("c1", "content-1", actor)).rejects.toBeInstanceOf(
      ContentSetNotFoundError,
    );
  });

  it("rejects approving a content set whose stored content fails schema validation", async () => {
    contentSetFindUnique.mockResolvedValue({
      id: "content-1",
      campaignId: "c1",
      version: 1,
      status: ContentSetStatus.draft,
      content: { facebook: [] },
    });

    await expect(approveContentSet("c1", "content-1", actor)).rejects.toBeInstanceOf(
      ContentSetContentInvalidError,
    );
    expect(contentSetUpdate).not.toHaveBeenCalled();
  });
});

describe("getApprovedContentSet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the approved content set", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    contentSetFindFirst.mockResolvedValue({ id: "content-1", status: ContentSetStatus.approved });

    const result = await getApprovedContentSet("c1");
    expect(result).toMatchObject({ id: "content-1", status: ContentSetStatus.approved });
    expect(contentSetFindFirst).toHaveBeenCalledWith({
      where: { campaignId: "c1", status: ContentSetStatus.approved },
    });
  });

  it("throws ContentSetNotApprovedError when no approved content set exists", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    contentSetFindFirst.mockResolvedValue(null);

    await expect(getApprovedContentSet("c1")).rejects.toBeInstanceOf(ContentSetNotApprovedError);
  });

  it("throws CampaignNotFoundError for a nonexistent campaign", async () => {
    campaignFindUnique.mockResolvedValue(null);
    await expect(getApprovedContentSet("missing")).rejects.toBeInstanceOf(CampaignNotFoundError);
  });
});
