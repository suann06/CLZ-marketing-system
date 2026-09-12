import { prisma } from "@/server/db/client";
import { logActivity, type Actor } from "@/lib/actor";
import type {
  CampaignBasicsInput,
} from "@/server/validation/campaign-schema";
import { Prisma, CampaignStatus } from "@prisma/client";

export class CampaignNotFoundError extends Error {
  constructor(campaignId: string) {
    super(`Campaign ${campaignId} not found.`);
    this.name = "CampaignNotFoundError";
  }
}

export class CampaignNotEditableError extends Error {
  constructor(campaignId: string, status: CampaignStatus) {
    super(
      `Campaign ${campaignId} is "${status}" and can no longer be edited — only draft campaigns can be changed.`,
    );
    this.name = "CampaignNotEditableError";
  }
}

export class CampaignValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignValidationError";
  }
}

async function getCampaignOrThrow(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) throw new CampaignNotFoundError(campaignId);
  return campaign;
}

function assertDraft(campaign: { id: string; status: CampaignStatus }) {
  if (campaign.status !== CampaignStatus.draft) {
    throw new CampaignNotEditableError(campaign.id, campaign.status);
  }
}

export async function createDraftCampaign(
  input: CampaignBasicsInput,
  actor: Actor,
) {
  const campaign = await prisma.campaign.create({
    data: {
      name: input.name,
      productPromotion: input.productPromotion,
      officialPricing: input.officialPricing as unknown as Prisma.InputJsonValue,
      startDate: input.startDate,
      endDate: input.endDate,
      createdById: actor.id,
      status: CampaignStatus.draft,
    },
  });

  await logActivity({
    entityType: "campaign",
    entityId: campaign.id,
    action: "created",
    actor,
  });

  return campaign;
}

export async function updateCampaignBasics(
  campaignId: string,
  input: CampaignBasicsInput,
  actor: Actor,
) {
  const existing = await getCampaignOrThrow(campaignId);
  assertDraft(existing);

  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      name: input.name,
      productPromotion: input.productPromotion,
      officialPricing: input.officialPricing as unknown as Prisma.InputJsonValue,
      startDate: input.startDate,
      endDate: input.endDate,
    },
  });

  await logActivity({
    entityType: "campaign",
    entityId: campaign.id,
    action: "basics_updated",
    actor,
  });

  return campaign;
}

export async function setDifferentiators(
  campaignId: string,
  differentiators: string[],
  actor: Actor,
) {
  const existing = await getCampaignOrThrow(campaignId);
  assertDraft(existing);

  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: { differentiators: differentiators as unknown as Prisma.InputJsonValue },
  });

  await logActivity({
    entityType: "campaign",
    entityId: campaign.id,
    action: "differentiators_updated",
    actor,
    metadata: { count: differentiators.length },
  });

  return campaign;
}

// Replaces which datasets a campaign targets. Datasets are selected
// independently of each other — this never merges or compares them.
// Removing a dataset also removes any building selections made under it, so
// campaign_buildings never points at a dataset the campaign no longer
// targets.
export async function setCampaignDatasets(
  campaignId: string,
  datasetIds: string[],
  actor: Actor,
) {
  const existing = await getCampaignOrThrow(campaignId);
  assertDraft(existing);

  const datasets = await prisma.dataset.findMany({
    where: { id: { in: datasetIds } },
    select: { id: true },
  });
  if (datasets.length !== datasetIds.length) {
    throw new CampaignValidationError("One or more selected datasets do not exist.");
  }

  await prisma.$transaction([
    prisma.campaignBuilding.deleteMany({
      where: { campaignId, datasetId: { notIn: datasetIds } },
    }),
    prisma.campaignDataset.deleteMany({
      where: { campaignId, datasetId: { notIn: datasetIds } },
    }),
    ...datasetIds.map((datasetId) =>
      prisma.campaignDataset.upsert({
        where: { campaignId_datasetId: { campaignId, datasetId } },
        create: { campaignId, datasetId },
        update: {},
      }),
    ),
  ]);

  await logActivity({
    entityType: "campaign",
    entityId: campaignId,
    action: "datasets_selected",
    actor,
    metadata: { datasetIds },
  });

  return getCampaignOrThrow(campaignId);
}

// Replaces which buildings are selected. Every building must belong to a
// dataset the campaign already targets (set via setCampaignDatasets) —
// buildings are never pulled in from an unselected dataset.
export async function setCampaignBuildings(
  campaignId: string,
  buildingIds: string[],
  actor: Actor,
) {
  const existing = await getCampaignOrThrow(campaignId);
  assertDraft(existing);

  const campaignDatasets = await prisma.campaignDataset.findMany({
    where: { campaignId },
    select: { datasetId: true },
  });
  const allowedDatasetIds = new Set(campaignDatasets.map((cd) => cd.datasetId));
  if (allowedDatasetIds.size === 0) {
    throw new CampaignValidationError(
      "Select at least one dataset before selecting buildings.",
    );
  }

  const buildings = await prisma.building.findMany({
    where: { id: { in: buildingIds } },
    select: { id: true, datasetId: true },
  });
  if (buildings.length !== buildingIds.length) {
    throw new CampaignValidationError("One or more selected buildings do not exist.");
  }
  const outOfScope = buildings.find((b) => !allowedDatasetIds.has(b.datasetId));
  if (outOfScope) {
    throw new CampaignValidationError(
      "One or more selected buildings belong to a dataset that isn't targeted by this campaign.",
    );
  }

  await prisma.$transaction([
    prisma.campaignBuilding.deleteMany({ where: { campaignId } }),
    prisma.campaignBuilding.createMany({
      data: buildings.map((b) => ({
        campaignId,
        buildingId: b.id,
        datasetId: b.datasetId,
      })),
    }),
  ]);

  await logActivity({
    entityType: "campaign",
    entityId: campaignId,
    action: "buildings_selected",
    actor,
    metadata: { count: buildingIds.length },
  });

  return getCampaignOrThrow(campaignId);
}

export async function confirmCampaign(campaignId: string, actor: Actor) {
  const campaign = await getCampaignOrThrow(campaignId);
  assertDraft(campaign);

  const [datasetCount, buildingCount] = await Promise.all([
    prisma.campaignDataset.count({ where: { campaignId } }),
    prisma.campaignBuilding.count({ where: { campaignId } }),
  ]);

  const problems: string[] = [];
  if (!campaign.name) problems.push("Campaign name is required.");
  if (!campaign.productPromotion) problems.push("Product/promotion is required.");
  if (datasetCount === 0) problems.push("Select at least one dataset.");
  if (buildingCount === 0) problems.push("Select at least one building.");
  if (problems.length > 0) {
    throw new CampaignValidationError(problems.join(" "));
  }

  const confirmed = await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: CampaignStatus.confirmed,
      confirmedById: actor.id,
      confirmedAt: new Date(),
    },
  });

  await logActivity({
    entityType: "campaign",
    entityId: campaignId,
    action: "confirmed",
    actor,
  });

  return confirmed;
}

export async function listCampaigns() {
  return prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { campaignDatasets: true, campaignBuildings: true } },
    },
  });
}

// Where "Open Campaign" should send an existing campaign, based on how far
// through Phase 1 it's already progressed. Step 1 (Basics) is what creates
// the campaign row, so any listed campaign has already completed it.
export function resumeCampaignPath(campaign: {
  id: string;
  status: CampaignStatus;
  differentiators: Prisma.JsonValue;
  _count: { campaignDatasets: number; campaignBuildings: number };
}): string {
  if (campaign.status !== CampaignStatus.draft) {
    return `/campaigns/${campaign.id}/buildings`;
  }
  if (!Array.isArray(campaign.differentiators) || campaign.differentiators.length === 0) {
    return `/campaigns/${campaign.id}/differentiators`;
  }
  if (campaign._count.campaignDatasets === 0) {
    return `/campaigns/${campaign.id}/datasets`;
  }
  if (campaign._count.campaignBuildings === 0) {
    return `/campaigns/${campaign.id}/buildings`;
  }
  return `/campaigns/${campaign.id}/review`;
}

export async function getCampaignDetail(campaignId: string) {
  const campaign = await getCampaignOrThrow(campaignId);
  const [datasets, buildings] = await Promise.all([
    prisma.campaignDataset.findMany({
      where: { campaignId },
      include: { dataset: true },
    }),
    prisma.campaignBuilding.findMany({
      where: { campaignId },
      include: { building: true },
    }),
  ]);

  return { campaign, datasets, buildings };
}

// The only interface Phase 2's content-generation service is meant to call.
// It never queries campaign/dataset/building tables directly — everything it
// needs comes through this brief, keeping the phases decoupled. Only
// confirmed-or-later campaigns can produce one.
export async function getCampaignBrief(campaignId: string) {
  const campaign = await getCampaignOrThrow(campaignId);
  if (campaign.status === CampaignStatus.draft) {
    throw new CampaignValidationError(
      "Campaign must be confirmed before a brief can be generated.",
    );
  }

  const [datasetCount, buildings] = await Promise.all([
    prisma.campaignDataset.count({ where: { campaignId } }),
    prisma.campaignBuilding.findMany({
      where: { campaignId },
      include: { building: { select: { id: true, name: true, address: true } } },
    }),
  ]);

  return {
    campaignId: campaign.id,
    productPromotion: campaign.productPromotion,
    officialPricing: campaign.officialPricing,
    differentiators: campaign.differentiators,
    targetingSummary: {
      datasetCount,
      buildingCount: buildings.length,
      buildings: buildings.map((cb) => cb.building),
    },
  };
}
