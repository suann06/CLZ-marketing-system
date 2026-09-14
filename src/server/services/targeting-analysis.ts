// Deterministic, read-only summarization of already-selected buildings for a
// confirmed campaign. Pure functions only — no Prisma/DB access here, and
// nothing here ever writes to or mutates a Building/Dataset row. Buildings
// are grouped strictly per dataset; datasets are never merged, matched, or
// deduplicated against each other, matching the Phase 1 data-integrity rule.

// An attribute is treated as "categorical" only when its distinct non-null
// string values across a dataset's selected buildings are at or below this
// count — e.g. a "Category" field with a handful of values qualifies, while
// a near-unique field like "FDC ID" does not.
export const MAX_CATEGORICAL_VALUES = 20;

export type TargetingBuildingInput = {
  datasetId: string;
  datasetName: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rawAttributes: unknown;
};

export type DatasetTargetingBreakdown = {
  datasetId: string;
  datasetName: string;
  buildingCount: number;
  buildingsWithAddress: number;
  buildingsWithCoordinates: number;
  availableAttributeKeys: string[];
  categoricalBreakdowns: Record<string, Record<string, number>>;
};

export type TargetingAnalysis = {
  totalSelectedBuildings: number;
  datasetCount: number;
  byDataset: DatasetTargetingBreakdown[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildDatasetBreakdown(
  datasetId: string,
  datasetName: string,
  buildings: TargetingBuildingInput[],
): DatasetTargetingBreakdown {
  const buildingsWithAddress = buildings.filter((b) => !!b.address).length;
  const buildingsWithCoordinates = buildings.filter(
    (b) => b.lat !== null && b.lng !== null,
  ).length;

  const allKeys = new Set<string>();
  const stringValueCounts = new Map<string, Map<string, number>>();

  for (const b of buildings) {
    if (!isPlainObject(b.rawAttributes)) continue;
    for (const [key, value] of Object.entries(b.rawAttributes)) {
      if (value === null || value === undefined) continue;
      allKeys.add(key);

      if (typeof value === "string" && value.trim() !== "") {
        let valueCounts = stringValueCounts.get(key);
        if (!valueCounts) {
          valueCounts = new Map();
          stringValueCounts.set(key, valueCounts);
        }
        valueCounts.set(value, (valueCounts.get(value) ?? 0) + 1);
      }
    }
  }

  const categoricalBreakdowns: Record<string, Record<string, number>> = {};
  for (const [key, valueCounts] of stringValueCounts.entries()) {
    if (valueCounts.size > 0 && valueCounts.size <= MAX_CATEGORICAL_VALUES) {
      categoricalBreakdowns[key] = Object.fromEntries(valueCounts.entries());
    }
  }

  return {
    datasetId,
    datasetName,
    buildingCount: buildings.length,
    buildingsWithAddress,
    buildingsWithCoordinates,
    availableAttributeKeys: Array.from(allKeys).sort(),
    categoricalBreakdowns,
  };
}

export function buildTargetingAnalysis(
  buildings: TargetingBuildingInput[],
): TargetingAnalysis {
  const order: string[] = [];
  const groups = new Map<string, { datasetName: string; buildings: TargetingBuildingInput[] }>();

  for (const b of buildings) {
    const existing = groups.get(b.datasetId);
    if (existing) {
      existing.buildings.push(b);
    } else {
      groups.set(b.datasetId, { datasetName: b.datasetName, buildings: [b] });
      order.push(b.datasetId);
    }
  }

  const byDataset = order.map((datasetId) => {
    const group = groups.get(datasetId)!;
    return buildDatasetBreakdown(datasetId, group.datasetName, group.buildings);
  });

  return {
    totalSelectedBuildings: buildings.length,
    datasetCount: byDataset.length,
    byDataset,
  };
}
