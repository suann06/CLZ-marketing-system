import { describe, expect, it, vi, beforeEach } from "vitest";
import { MarketingStrategyStatus, CampaignStatus } from "@prisma/client";

// Prisma AND the Anthropic provider are both fully mocked — these tests
// never touch the real Supabase database or the real Anthropic API.
const {
  campaignFindUnique,
  campaignDatasetFindMany,
  campaignBuildingFindMany,
  marketingStrategyFindFirst,
  marketingStrategyFindUnique,
  marketingStrategyCreate,
  marketingStrategyUpdate,
  marketingStrategyUpdateMany,
  logActivityMock,
  generateStructuredCompletionMock,
} = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  campaignDatasetFindMany: vi.fn(),
  campaignBuildingFindMany: vi.fn(),
  marketingStrategyFindFirst: vi.fn(),
  marketingStrategyFindUnique: vi.fn(),
  marketingStrategyCreate: vi.fn(),
  marketingStrategyUpdate: vi.fn(),
  marketingStrategyUpdateMany: vi.fn(),
  logActivityMock: vi.fn(),
  generateStructuredCompletionMock: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    campaign: { findUnique: campaignFindUnique },
    campaignDataset: { findMany: campaignDatasetFindMany },
    campaignBuilding: { findMany: campaignBuildingFindMany },
    marketingStrategy: {
      findFirst: marketingStrategyFindFirst,
      findUnique: marketingStrategyFindUnique,
      create: marketingStrategyCreate,
      update: marketingStrategyUpdate,
      updateMany: marketingStrategyUpdateMany,
    },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        marketingStrategy: {
          create: marketingStrategyCreate,
          update: marketingStrategyUpdate,
          updateMany: marketingStrategyUpdateMany,
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
  generateMarketingStrategy,
  getLatestMarketingStrategy,
  editMarketingStrategy,
  approveMarketingStrategy,
  getApprovedMarketingStrategy,
  AiGenerationError,
  MarketingStrategyNotFoundError,
  MarketingStrategyNotEditableError,
  MarketingStrategyContentInvalidError,
  MarketingStrategyNotApprovedError,
} from "@/server/services/marketing-strategy-service";
import { AiProviderError } from "@/server/ai/anthropic-client";
import { CampaignNotFoundError } from "@/server/services/campaign-service";
import type { MarketingStrategyOutput } from "@/server/ai/schemas/marketing-strategy-output";

const validOutput: MarketingStrategyOutput = {
  targetAudience: { description: "Urban professionals", segments: ["Young professionals"] },
  customerNeeds: ["Reliable internet"],
  positioning: "Fast and reliable fiber for CBD professionals.",
  marketingAngles: ["Speed matters"],
  messagingPillars: [{ title: "Reliability", description: "Always on." }],
  platformDirection: [{ platform: "facebook", direction: "Highlight speed." }],
  cta: "Sign up today",
};

function setupConfirmedCampaignWithBrief() {
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
      building: { id: "b1", name: "A", address: null, lat: null, lng: null, rawAttributes: { Category: "CAT 2" } },
    },
    {
      campaignId: "c1",
      datasetId: "d1",
      buildingId: "b2",
      building: { id: "b2", name: "B", address: "X", lat: 1, lng: 2, rawAttributes: { Category: "CAT 2" } },
    },
  ]);
}

const actor = { type: "human" as const, id: "user-1" };

describe("generateMarketingStrategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    marketingStrategyCreate.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({ id: "strategy-1", ...data }),
    );
  });

  it("generates and persists a valid strategy as version 1", async () => {
    setupConfirmedCampaignWithBrief();
    marketingStrategyFindFirst.mockResolvedValue(null);
    generateStructuredCompletionMock.mockResolvedValue(JSON.stringify(validOutput));

    const strategy = await generateMarketingStrategy("c1", actor);

    expect(generateStructuredCompletionMock).toHaveBeenCalledTimes(1);
    expect(marketingStrategyCreate).toHaveBeenCalledTimes(1);
    expect(marketingStrategyUpdate).not.toHaveBeenCalled();
    expect(strategy).toMatchObject({
      campaignId: "c1",
      version: 1,
      status: MarketingStrategyStatus.draft,
    });
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ai_strategy_generated", actor: { type: "ai", id: null } }),
    );
  });

  it("retries once on malformed JSON, then succeeds", async () => {
    setupConfirmedCampaignWithBrief();
    marketingStrategyFindFirst.mockResolvedValue(null);
    generateStructuredCompletionMock
      .mockResolvedValueOnce("not json")
      .mockResolvedValueOnce(JSON.stringify(validOutput));

    const strategy = await generateMarketingStrategy("c1", actor);

    expect(generateStructuredCompletionMock).toHaveBeenCalledTimes(2);
    expect(strategy.version).toBe(1);
  });

  it("throws AiGenerationError after 2 invalid attempts, logs a failure, and never creates a strategy", async () => {
    setupConfirmedCampaignWithBrief();
    marketingStrategyFindFirst.mockResolvedValue(null);
    generateStructuredCompletionMock.mockResolvedValue("still not json");

    await expect(generateMarketingStrategy("c1", actor)).rejects.toBeInstanceOf(AiGenerationError);

    expect(generateStructuredCompletionMock).toHaveBeenCalledTimes(2);
    expect(marketingStrategyCreate).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ai_strategy_generation_failed", actor: { type: "ai", id: null } }),
    );
  });

  it("does not retry a non-retryable provider error", async () => {
    setupConfirmedCampaignWithBrief();
    marketingStrategyFindFirst.mockResolvedValue(null);
    generateStructuredCompletionMock.mockRejectedValue(new AiProviderError("bad request", false));

    await expect(generateMarketingStrategy("c1", actor)).rejects.toBeInstanceOf(AiGenerationError);
    expect(generateStructuredCompletionMock).toHaveBeenCalledTimes(1);
  });

  it("retries a retryable provider error once and succeeds", async () => {
    setupConfirmedCampaignWithBrief();
    marketingStrategyFindFirst.mockResolvedValue(null);
    generateStructuredCompletionMock
      .mockRejectedValueOnce(new AiProviderError("rate limited", true))
      .mockResolvedValueOnce(JSON.stringify(validOutput));

    const strategy = await generateMarketingStrategy("c1", actor);

    expect(generateStructuredCompletionMock).toHaveBeenCalledTimes(2);
    expect(strategy.version).toBe(1);
  });

  it("archives the previous draft and creates version 2 on regeneration", async () => {
    setupConfirmedCampaignWithBrief();
    marketingStrategyFindFirst.mockResolvedValue({
      id: "strategy-1",
      version: 1,
      status: MarketingStrategyStatus.draft,
    });
    generateStructuredCompletionMock.mockResolvedValue(JSON.stringify(validOutput));

    const strategy = await generateMarketingStrategy("c1", actor);

    expect(marketingStrategyUpdate).toHaveBeenCalledWith({
      where: { id: "strategy-1" },
      data: { status: MarketingStrategyStatus.archived },
    });
    expect(strategy.version).toBe(2);
  });

  it("does not archive a previously approved version on regeneration", async () => {
    setupConfirmedCampaignWithBrief();
    marketingStrategyFindFirst.mockResolvedValue({
      id: "strategy-1",
      version: 1,
      status: MarketingStrategyStatus.approved,
    });
    generateStructuredCompletionMock.mockResolvedValue(JSON.stringify(validOutput));

    const strategy = await generateMarketingStrategy("c1", actor);

    expect(marketingStrategyUpdate).not.toHaveBeenCalled();
    expect(strategy.version).toBe(2);
  });
});

describe("getLatestMarketingStrategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws CampaignNotFoundError for a nonexistent campaign", async () => {
    campaignFindUnique.mockResolvedValue(null);
    await expect(getLatestMarketingStrategy("missing")).rejects.toBeInstanceOf(CampaignNotFoundError);
  });

  it("throws MarketingStrategyNotFoundError when no strategy exists yet", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    marketingStrategyFindFirst.mockResolvedValue(null);
    await expect(getLatestMarketingStrategy("c1")).rejects.toBeInstanceOf(MarketingStrategyNotFoundError);
  });

  it("returns the latest strategy", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    marketingStrategyFindFirst.mockResolvedValue({ id: "s1", version: 3 });
    const result = await getLatestMarketingStrategy("c1");
    expect(result).toMatchObject({ id: "s1", version: 3 });
  });
});

describe("editMarketingStrategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    marketingStrategyCreate.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({ id: "strategy-2", ...data }),
    );
  });

  it("allows editing the current draft, archiving it and creating the next version", async () => {
    marketingStrategyFindUnique.mockResolvedValue({
      id: "strategy-1",
      campaignId: "c1",
      version: 1,
      status: MarketingStrategyStatus.draft,
      inputSnapshot: { productPromotion: "Fiber 100Mbps" },
    });
    marketingStrategyFindFirst.mockResolvedValue({ id: "strategy-1" });

    const edited = { ...validOutput, cta: "Call us now" };
    const result = await editMarketingStrategy("c1", "strategy-1", edited, actor);

    expect(marketingStrategyUpdate).toHaveBeenCalledWith({
      where: { id: "strategy-1" },
      data: { status: MarketingStrategyStatus.archived },
    });
    expect(marketingStrategyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: "c1",
        version: 2,
        status: MarketingStrategyStatus.draft,
        generatedById: actor.id,
      }),
    });
    expect(result.version).toBe(2);
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "strategy_edited", actor }),
    );
  });

  it("carries the original inputSnapshot over unchanged, without re-deriving it", async () => {
    marketingStrategyFindUnique.mockResolvedValue({
      id: "strategy-1",
      campaignId: "c1",
      version: 1,
      status: MarketingStrategyStatus.draft,
      inputSnapshot: { productPromotion: "Original Snapshot" },
    });
    marketingStrategyFindFirst.mockResolvedValue({ id: "strategy-1" });

    await editMarketingStrategy("c1", "strategy-1", validOutput, actor);

    expect(marketingStrategyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ inputSnapshot: { productPromotion: "Original Snapshot" } }),
    });
  });

  it("throws MarketingStrategyNotFoundError when the strategy does not exist", async () => {
    marketingStrategyFindUnique.mockResolvedValue(null);
    await expect(editMarketingStrategy("c1", "missing", validOutput, actor)).rejects.toBeInstanceOf(
      MarketingStrategyNotFoundError,
    );
  });

  it("throws MarketingStrategyNotFoundError when the strategy belongs to a different campaign", async () => {
    marketingStrategyFindUnique.mockResolvedValue({
      id: "strategy-1",
      campaignId: "other-campaign",
      version: 1,
      status: MarketingStrategyStatus.draft,
    });
    await expect(editMarketingStrategy("c1", "strategy-1", validOutput, actor)).rejects.toBeInstanceOf(
      MarketingStrategyNotFoundError,
    );
  });

  it("rejects editing an archived strategy", async () => {
    marketingStrategyFindUnique.mockResolvedValue({
      id: "strategy-1",
      campaignId: "c1",
      version: 1,
      status: MarketingStrategyStatus.archived,
    });
    marketingStrategyFindFirst.mockResolvedValue({ id: "strategy-1" });

    await expect(editMarketingStrategy("c1", "strategy-1", validOutput, actor)).rejects.toBeInstanceOf(
      MarketingStrategyNotEditableError,
    );
    expect(marketingStrategyCreate).not.toHaveBeenCalled();
  });

  it("rejects editing an approved strategy directly", async () => {
    marketingStrategyFindUnique.mockResolvedValue({
      id: "strategy-1",
      campaignId: "c1",
      version: 1,
      status: MarketingStrategyStatus.approved,
    });
    marketingStrategyFindFirst.mockResolvedValue({ id: "strategy-1" });

    await expect(editMarketingStrategy("c1", "strategy-1", validOutput, actor)).rejects.toBeInstanceOf(
      MarketingStrategyNotEditableError,
    );
    expect(marketingStrategyCreate).not.toHaveBeenCalled();
  });

  it("rejects editing a draft that has already been superseded by a newer version", async () => {
    marketingStrategyFindUnique.mockResolvedValue({
      id: "strategy-1",
      campaignId: "c1",
      version: 1,
      status: MarketingStrategyStatus.draft,
    });
    // A newer version already exists — strategy-1 is stale even though its
    // own status still (momentarily) says draft.
    marketingStrategyFindFirst.mockResolvedValue({ id: "strategy-2" });

    await expect(editMarketingStrategy("c1", "strategy-1", validOutput, actor)).rejects.toBeInstanceOf(
      MarketingStrategyNotEditableError,
    );
  });
});

describe("approveMarketingStrategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    marketingStrategyUpdate.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "strategy-1",
        campaignId: "c1",
        version: 1,
        ...data,
      }),
    );
  });

  it("approves a draft strategy and records approvedById/approvedAt", async () => {
    marketingStrategyFindUnique.mockResolvedValue({
      id: "strategy-1",
      campaignId: "c1",
      version: 1,
      status: MarketingStrategyStatus.draft,
      content: validOutput,
    });

    const result = await approveMarketingStrategy("c1", "strategy-1", actor);

    expect(marketingStrategyUpdate).toHaveBeenCalledWith({
      where: { id: "strategy-1" },
      data: expect.objectContaining({
        status: MarketingStrategyStatus.approved,
        approvedById: actor.id,
        approvedAt: expect.any(Date),
      }),
    });
    expect(result.status).toBe(MarketingStrategyStatus.approved);
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "strategy_approved", actor }),
    );
  });

  it("archives the previously approved version atomically", async () => {
    marketingStrategyFindUnique.mockResolvedValue({
      id: "strategy-2",
      campaignId: "c1",
      version: 2,
      status: MarketingStrategyStatus.draft,
      content: validOutput,
    });

    await approveMarketingStrategy("c1", "strategy-2", actor);

    expect(marketingStrategyUpdateMany).toHaveBeenCalledWith({
      where: { campaignId: "c1", status: MarketingStrategyStatus.approved },
      data: { status: MarketingStrategyStatus.archived },
    });
  });

  it("rejects approving an archived strategy", async () => {
    marketingStrategyFindUnique.mockResolvedValue({
      id: "strategy-1",
      campaignId: "c1",
      version: 1,
      status: MarketingStrategyStatus.archived,
      content: validOutput,
    });

    await expect(approveMarketingStrategy("c1", "strategy-1", actor)).rejects.toBeInstanceOf(
      MarketingStrategyNotEditableError,
    );
  });

  it("rejects approving an already-approved strategy", async () => {
    marketingStrategyFindUnique.mockResolvedValue({
      id: "strategy-1",
      campaignId: "c1",
      version: 1,
      status: MarketingStrategyStatus.approved,
      content: validOutput,
    });

    await expect(approveMarketingStrategy("c1", "strategy-1", actor)).rejects.toBeInstanceOf(
      MarketingStrategyNotEditableError,
    );
  });

  it("throws MarketingStrategyNotFoundError when the strategy belongs to a different campaign", async () => {
    marketingStrategyFindUnique.mockResolvedValue({
      id: "strategy-1",
      campaignId: "other-campaign",
      version: 1,
      status: MarketingStrategyStatus.draft,
      content: validOutput,
    });

    await expect(approveMarketingStrategy("c1", "strategy-1", actor)).rejects.toBeInstanceOf(
      MarketingStrategyNotFoundError,
    );
  });

  it("rejects approving a strategy whose stored content fails schema validation", async () => {
    marketingStrategyFindUnique.mockResolvedValue({
      id: "strategy-1",
      campaignId: "c1",
      version: 1,
      status: MarketingStrategyStatus.draft,
      content: { not: "valid" },
    });

    await expect(approveMarketingStrategy("c1", "strategy-1", actor)).rejects.toBeInstanceOf(
      MarketingStrategyContentInvalidError,
    );
    expect(marketingStrategyUpdate).not.toHaveBeenCalled();
  });
});

describe("getApprovedMarketingStrategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the approved version", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    marketingStrategyFindFirst.mockResolvedValue({
      id: "strategy-1",
      status: MarketingStrategyStatus.approved,
    });

    const result = await getApprovedMarketingStrategy("c1");
    expect(result).toMatchObject({ id: "strategy-1", status: MarketingStrategyStatus.approved });
    expect(marketingStrategyFindFirst).toHaveBeenCalledWith({
      where: { campaignId: "c1", status: MarketingStrategyStatus.approved },
    });
  });

  it("throws MarketingStrategyNotApprovedError when no approved version exists", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    marketingStrategyFindFirst.mockResolvedValue(null);

    await expect(getApprovedMarketingStrategy("c1")).rejects.toBeInstanceOf(
      MarketingStrategyNotApprovedError,
    );
  });

  it("throws CampaignNotFoundError for a nonexistent campaign", async () => {
    campaignFindUnique.mockResolvedValue(null);
    await expect(getApprovedMarketingStrategy("missing")).rejects.toBeInstanceOf(CampaignNotFoundError);
  });
});
