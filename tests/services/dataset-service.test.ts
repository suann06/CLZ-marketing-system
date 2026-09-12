import { describe, expect, it } from "vitest";
import { mapRowToBuilding } from "@/server/services/dataset-service";

describe("mapRowToBuilding", () => {
  it("accepts a Building Name column with no Address column, leaving address null", () => {
    const headers = [
      "Building Name",
      "Category",
      "FDC ID",
      "In_service",
      "HSBA Subs",
      "Available ports",
    ];
    const row = {
      "Building Name": "Menara ABC",
      Category: "Residential",
      "FDC ID": "FDC-001",
      In_service: "Yes",
      "HSBA Subs": 120,
      "Available ports": 48,
    };

    const result = mapRowToBuilding(row, headers);

    expect(result).not.toBeNull();
    expect(result?.name).toBe("Menara ABC");
    expect(result?.address).toBeNull();
    // Unmapped source columns must be preserved verbatim in rawAttributes.
    expect(result?.rawAttributes).toEqual({
      Category: "Residential",
      "FDC ID": "FDC-001",
      In_service: "Yes",
      "HSBA Subs": 120,
      "Available ports": 48,
    });
  });

  it("still maps an address when an Address column is present (existing datasets keep working)", () => {
    const headers = ["Building Name", "Address"];
    const row = { "Building Name": "Menara XYZ", Address: "1 Jalan Test" };

    const result = mapRowToBuilding(row, headers);

    expect(result?.name).toBe("Menara XYZ");
    expect(result?.address).toBe("1 Jalan Test");
  });

  it("matches header variations in capitalization/spacing without altering cell values", () => {
    const headers = ["building_name", "  ADDRESS  "];
    const row = { building_name: "  Menara Raw Value  ", "  ADDRESS  ": "42 Jalan Raw" };

    const result = mapRowToBuilding(row, headers);

    // Header matching is normalized; the cell value itself is untouched.
    expect(result?.name).toBe("  Menara Raw Value  ");
    expect(result?.address).toBe("42 Jalan Raw");
  });

  it("returns null when no name column is present", () => {
    const headers = ["Category", "Address"];
    const row = { Category: "Commercial", Address: "Somewhere" };

    const result = mapRowToBuilding(row, headers);

    expect(result).toBeNull();
  });
});
