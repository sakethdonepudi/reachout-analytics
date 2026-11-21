import * as XLSX from "xlsx";
import { REASON_HEADERS, SEGMENT_HEADERS } from "./schema";

export type DatasetKind = "segments" | "reasons";

export const DATASET_SHEET: Record<DatasetKind, string> = {
  segments: "Segments",
  reasons: "Reasons",
};

export function buildDatasetWorkbook(kind: DatasetKind): Buffer {
  const headers = kind === "segments" ? [...SEGMENT_HEADERS] : [...REASON_HEADERS];
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers]);
  sheet["!cols"] = headers.map((header) => ({ wch: Math.max(14, header.length + 4) }));
  XLSX.utils.book_append_sheet(wb, sheet, DATASET_SHEET[kind]);
  const notes = XLSX.utils.aoa_to_sheet([
    ["Dataset", kind === "segments" ? "Vote share segments" : "Vote share reasons"],
    ["How to use", "Fill one row per value. Do not rename the columns or the sheet."],
    ...(kind === "segments"
      ? [
          ["Poll Type", "opinion or exit"],
          ["Scope", "statewide, district or assembly"],
          ["Segment Type", "gender, age, caste or region"],
          ["Share", "Percentage from 0 to 100"],
          ["N", "Optional sample size"],
        ]
      : [
          ["Before / After", "JSON arrays like [{\"segment\":\"Male\",\"before\":32.1,\"after\":35.4}]"],
          ["Segments", "Comma-separated labels"],
          ["Campaigns", "Comma-separated campaign IDs"],
          ["Social URLs", "Comma-separated URLs"],
        ]),
  ]);
  XLSX.utils.book_append_sheet(wb, notes, "Notes");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function parseDatasetWorkbook(kind: DatasetKind, buffer: ArrayBuffer | Buffer): { rows: Record<string, unknown>[]; error?: string } {
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets[DATASET_SHEET[kind]] ?? wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { rows: [], error: `Add a sheet named ${DATASET_SHEET[kind]}.` };
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
    return { rows };
  } catch {
    return { rows: [], error: "That workbook could not be read. Check it opens in Excel and try again." };
  }
}
