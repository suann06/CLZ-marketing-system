import { describe, expect, it } from "vitest";
import {
  buildTargetingAnalysis,
  MAX_CATEGORICAL_VALUES,
  type TargetingBuildingInput,
} from "@/server/services/targeting-analysis";

describe("buildTargetingAnalysis", () => {
  it("summarizes selected buildings grouped by dataset without merging datasets", () => {
    const buildings: TargetingBuildingInput[] = [
      {
        datasetId: "d1",
        datasetName: "Dataset A",
        address: "123 Street",
        lat: 3.1,
        lng: 101.6,
        rawAttributes: { Category: "CAT 2 TIME" },
      },
      {
        datasetId: "d1",
        datasetName: "Dataset A",
        address: null,
        lat: null,
        lng: null,
        rawAttributes: { Category: "CAT 2 TIME" },
      },
      {
        datasetId: "d2",
        datasetName: "Dataset B",
        address: "456 Road",
        lat: null,
        lng: null,
        rawAttributes: { Category: "CAT 1" },
      },
    ];

    const result = buildTargetingAnalysis(buildings);

    expect(result.totalSelectedBuildings).toBe(3);
    expect(result.datasetCount).toBe(2);
    expect(result.byDataset.map((d) => d.datasetId)).toEqual(["d1", "d2"]);

    const datasetA = result.byDataset.find((d) => d.datasetId === "d1")!;
    expect(datasetA.buildingCount).toBe(2);
    expect(datasetA.buildingsWithAddress).toBe(1);
    expect(datasetA.buildingsWithCoordinates).toBe(1);
    expect(datasetA.categoricalBreakdowns).toEqual({ Category: { "CAT 2 TIME": 2 } });

    const datasetB = result.byDataset.find((d) => d.datasetId === "d2")!;
    expect(datasetB.categoricalBreakdowns).toEqual({ Category: { "CAT 1": 1 } });
  });

  it("excludes high-cardinality attributes (e.g. near-unique IDs) from categorical breakdowns", () => {
    const buildings: TargetingBuildingInput[] = Array.from(
      { length: MAX_CATEGORICAL_VALUES + 5 },
      (_, i) => ({
        datasetId: "d1",
        datasetName: "Dataset A",
        address: null,
        lat: null,
        lng: null,
        rawAttributes: { "FDC ID": `FDC-${i}`, Category: "CAT 2 TIME" },
      }),
    );

    const result = buildTargetingAnalysis(buildings);
    const datasetA = result.byDataset[0];

    expect(datasetA.availableAttributeKeys).toEqual(["Category", "FDC ID"]);
    expect(datasetA.categoricalBreakdowns).toHaveProperty("Category");
    expect(datasetA.categoricalBreakdowns).not.toHaveProperty("FDC ID");
  });

  it("does not invent data for missing fields — only reports keys actually present", () => {
    const buildings: TargetingBuildingInput[] = [
      { datasetId: "d1", datasetName: "Dataset A", address: null, lat: null, lng: null, rawAttributes: {} },
    ];

    const result = buildTargetingAnalysis(buildings);

    expect(result.byDataset[0].availableAttributeKeys).toEqual([]);
    expect(result.byDataset[0].categoricalBreakdowns).toEqual({});
  });

  it("does not mutate the input buildings array or its objects", () => {
    const building: TargetingBuildingInput = {
      datasetId: "d1",
      datasetName: "Dataset A",
      address: "X",
      lat: 1,
      lng: 2,
      rawAttributes: { Category: "A" },
    };
    const buildings = [building];
    const snapshot = JSON.parse(JSON.stringify(buildings));

    buildTargetingAnalysis(buildings);

    expect(buildings).toEqual(snapshot);
    expect(buildings[0]).toBe(building);
  });
});
