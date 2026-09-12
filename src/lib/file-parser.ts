import Papa from "papaparse";
import ExcelJS from "exceljs";

export type ParsedRow = Record<string, string | number | null>;

export type ParsedFile = {
  headers: string[];
  rows: ParsedRow[];
};

const EXCEL_EXTENSIONS = [".xlsx", ".xlsm", ".xls"];

// Parses an uploaded building dataset file (CSV or Excel) into raw rows.
// Deliberately does no cleaning, matching, or deduplication — that mapping
// happens one layer up in dataset-service, and only within a single file.
export async function parseDatasetFile(
  buffer: Buffer,
  filename: string,
): Promise<ParsedFile> {
  const lower = filename.toLowerCase();

  if (EXCEL_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return parseExcel(buffer);
  }

  return parseCsv(buffer);
}

function parseCsv(buffer: Buffer): ParsedFile {
  const text = buffer.toString("utf-8");
  const result = Papa.parse<ParsedRow>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    transformHeader: (header) => header.trim(),
  });

  if (result.errors.length > 0) {
    const first = result.errors[0];
    throw new Error(`Failed to parse CSV at row ${first.row}: ${first.message}`);
  }

  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
  };
}

async function parseExcel(buffer: Buffer): Promise<ParsedFile> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's bundled types declare `Buffer` against an older @types/node
  // shape than ours (^24), so the structurally-identical runtime Buffer
  // needs a cast to satisfy exceljs's own declared parameter type here.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Excel file has no worksheets.");
  }

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "").trim();
  });

  const rows: ParsedRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header row

    const record: ParsedRow = {};
    let hasValue = false;
    headers.forEach((header, index) => {
      if (!header) return;
      const cell = row.getCell(index + 1);
      const value = normalizeCellValue(cell.value);
      record[header] = value;
      if (value !== null && value !== "") hasValue = true;
    });

    if (hasValue) rows.push(record);
  });

  return { headers: headers.filter(Boolean), rows };
}

function normalizeCellValue(value: ExcelJS.CellValue): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && "text" in value) {
    return String((value as { text: unknown }).text);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || typeof value === "string") return value;
  return String(value);
}
