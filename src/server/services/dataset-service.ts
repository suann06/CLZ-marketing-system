import { prisma } from "@/server/db/client";
import { logActivity, type Actor } from "@/lib/actor";
import { parseDatasetFile, type ParsedRow } from "@/lib/file-parser";
import { Prisma } from "@prisma/client";

export class DatasetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatasetValidationError";
  }
}

const NAME_COLUMNS = ["name", "building_name", "building", "property_name"];
const ADDRESS_COLUMNS = ["address", "building_address", "full_address"];
const LAT_COLUMNS = ["lat", "latitude"];
const LNG_COLUMNS = ["lng", "lon", "long", "longitude"];
const UNIT_COUNT_COLUMNS = ["unit_count", "units", "no_of_units", "unit"];

// Header-key matching only — e.g. "Building Name", "building_name" and
// "building name" all resolve to the same lookup key. This never touches
// the actual cell values, only which column a value is read from.
function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findValue(
  row: ParsedRow,
  headerLookup: Map<string, string>,
  candidates: string[],
): ParsedRow[string] | undefined {
  for (const candidate of candidates) {
    const actualHeader = headerLookup.get(normalizeHeader(candidate));
    if (actualHeader && row[actualHeader] !== undefined && row[actualHeader] !== null) {
      return row[actualHeader];
    }
  }
  return undefined;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function toIntOrNull(value: unknown): number | null {
  const num = toNumberOrNull(value);
  return num === null ? null : Math.trunc(num);
}

// Maps one row of an uploaded file to a building record. Any column not
// recognized as name/address/lat/lng/unit_count is kept verbatim in
// rawAttributes rather than discarded — the importer doesn't force a rigid
// schema onto whatever the source file actually contains. Only `name` is
// required; `address` is optional and left null when the file has no
// recognizable address column (e.g. the real CLZ export, which has only a
// Building Name column).
export function mapRowToBuilding(row: ParsedRow, headers: string[]) {
  const headerLookup = new Map(headers.map((h) => [normalizeHeader(h), h]));

  const name = findValue(row, headerLookup, NAME_COLUMNS);
  if (!name) {
    return null;
  }

  const addressValue = findValue(row, headerLookup, ADDRESS_COLUMNS);

  const recognizedHeaders = new Set<string>();
  for (const candidates of [NAME_COLUMNS, ADDRESS_COLUMNS, LAT_COLUMNS, LNG_COLUMNS, UNIT_COUNT_COLUMNS]) {
    for (const candidate of candidates) {
      const actualHeader = headerLookup.get(normalizeHeader(candidate));
      if (actualHeader) recognizedHeaders.add(actualHeader);
    }
  }

  const rawAttributes: Record<string, unknown> = {};
  for (const header of headers) {
    if (!recognizedHeaders.has(header)) {
      rawAttributes[header] = row[header] ?? null;
    }
  }

  return {
    name: String(name),
    address: addressValue !== undefined ? String(addressValue) : null,
    lat: toNumberOrNull(findValue(row, headerLookup, LAT_COLUMNS)),
    lng: toNumberOrNull(findValue(row, headerLookup, LNG_COLUMNS)),
    unitCount: toIntOrNull(findValue(row, headerLookup, UNIT_COUNT_COLUMNS)),
    rawAttributes: rawAttributes as unknown as Prisma.InputJsonValue,
  };
}

// One uploaded file becomes exactly one independent dataset. This never
// reads or compares against any other dataset's buildings.
export async function importDataset(
  file: { buffer: Buffer; filename: string },
  datasetName: string,
  actor: Actor,
) {
  const parsed = await parseDatasetFile(file.buffer, file.filename);

  const buildingRows = parsed.rows
    .map((row) => mapRowToBuilding(row, parsed.headers))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (buildingRows.length === 0) {
    throw new DatasetValidationError(
      "No usable rows found — the file needs at least a name column per building.",
    );
  }

  const dataset = await prisma.dataset.create({
    data: {
      name: datasetName,
      sourceFilename: file.filename,
      importedById: actor.id,
      rowCount: buildingRows.length,
      buildings: {
        createMany: { data: buildingRows },
      },
    },
  });

  await logActivity({
    entityType: "dataset",
    entityId: dataset.id,
    action: "imported",
    actor,
    metadata: { filename: file.filename, rowCount: buildingRows.length },
  });

  return dataset;
}

export async function listDatasets() {
  return prisma.dataset.findMany({
    orderBy: { importedAt: "desc" },
    include: { _count: { select: { buildings: true } } },
  });
}

export async function getDatasetWithBuildings(datasetId: string) {
  return prisma.dataset.findUnique({
    where: { id: datasetId },
    include: { buildings: { orderBy: { name: "asc" } } },
  });
}
