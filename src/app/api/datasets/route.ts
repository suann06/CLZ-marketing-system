import { NextResponse } from "next/server";
import { requireHumanActorOrResponse } from "@/lib/actor";
import { importDataset, listDatasets, DatasetValidationError } from "@/server/services/dataset-service";

export const dynamic = "force-dynamic";

const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xlsm", ".xls"];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export async function GET() {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;
  void actor;

  const datasets = await listDatasets();
  return NextResponse.json({ datasets });
}

// One uploaded file becomes exactly one independent Dataset — see
// dataset-service.importDataset(), which this route is a thin wrapper
// around. No cleaning, matching, merging, or deduplication happens here or
// in that service.
export async function POST(request: Request) {
  const { actor, response } = await requireHumanActorOrResponse();
  if (response) return response;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  if (!hasAllowedExtension) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a CSV or Excel (.xlsx, .xlsm, .xls) file." },
      { status: 400 },
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 20MB)." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const datasetName = file.name.replace(/\.[^/.]+$/, "");

  try {
    const dataset = await importDataset({ buffer, filename: file.name }, datasetName, actor);
    return NextResponse.json({ dataset }, { status: 201 });
  } catch (err) {
    if (err instanceof DatasetValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
