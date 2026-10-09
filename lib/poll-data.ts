import * as XLSX from "xlsx";
import { TN_DISTRICTS } from "@/lib/data/tamil-nadu-districts";

/* =====================================================================
   Poll workbook format + validation.

   One .xlsx workbook, exactly two sheets: "Opinion Poll" and "Exit Poll".
   Every row is one response. The sheet name determines the poll type.
   Unknown/extra columns are preserved (never silently dropped).
   ===================================================================== */

export const SHEETS = ["Opinion Poll", "Exit Poll"] as const;
export type PollType = "opinion" | "exit";
export const SHEET_OF: Record<PollType, (typeof SHEETS)[number]> = { opinion: "Opinion Poll", exit: "Exit Poll" };

/** Canonical column order (as supplied). Extra columns are kept on export. */
export const HEADERS = [
  "Response ID", "Survey", "State", "District", "Assembly Constituency", "PIN Code", "Party", "Entry Date",
  "Response Status", "Form ID", "Zone", "District Original", "Assembly Constituency Original", "Party Original",
  "Entry Date Original", "Month", "Source Row", "District Key", "PIN Status", "Entry Datetime ISO", "Timing Group",
  "District Status", "AC Status", "Signature Frequency", "Repeat Status", "AC Number", "Geography Action",
  "Geography Mapping Source", "Estimated District", "District for Scenario", "Geography Basis", "Allocation Method",
  "Allocation Scenario",
] as const;

/** Bare minimum to accept a sheet. */
export const REQUIRED = ["Response ID", "Party"] as const;

/** Party categories treated as valid responses (statewide shares use these). */
export const VALID_PARTIES = ["TVK", "DMK+INC+VCK", "AIADMK+BJP+PMK+AMMK", "NTK", "NOTA", "Others"] as const;
const BLANK_PARTY = new Set(["", "no response"]);

export const GEO_RECORDED = "Recorded or source-mapped district";
export const GEO_ESTIMATED = "Estimated allocation";

const DISTRICT_NAMES = new Set(TN_DISTRICTS.map((d) => d.name));

export type Row = Record<string, unknown>;
export type PartyStatus = "valid" | "blank" | "invalid";

export function partyStatus(party: unknown): PartyStatus {
  const p = String(party ?? "").trim();
  if (BLANK_PARTY.has(p.toLowerCase())) return "blank";
  if ((VALID_PARTIES as readonly string[]).includes(p)) return "valid";
  return "invalid";
}

export function isRecordedDistrict(row: Row): boolean {
  return String(row["District"] ?? "").trim() !== "";
}
export function estimatedDistrictOf(row: Row): string {
  return String(row["Estimated District"] ?? "").trim();
}
export function recordedDistrictOf(row: Row): string {
  return String(row["District"] ?? "").trim();
}
export function scenarioDistrictOf(row: Row): string {
  return String(row["District for Scenario"] ?? row["District"] ?? row["Estimated District"] ?? "").trim();
}

export type RowIssue = { sheet: string; row: number; field: string; reason: string; severity: "error" | "warning" };

export type SheetValidation = {
  total: number;
  valid: number;
  blank: number;
  invalid: number;
  recorded: number;
  estimated: number;
  unknownDistrict: number;
  issues: RowIssue[];
  headers: string[];
};

/** Parse a workbook buffer into per-sheet row objects + structural errors. */
export function parseWorkbook(buf: ArrayBuffer | Buffer): { sheets: Record<PollType, Row[]>; headers: Record<PollType, string[]>; errors: RowIssue[] } {
  const wb = XLSX.read(buf, { type: "buffer" });
  const errors: RowIssue[] = [];
  const out = { opinion: [] as Row[], exit: [] as Row[] };
  const headers = { opinion: [] as string[], exit: [] as string[] };

  for (const name of SHEETS) {
    if (!wb.SheetNames.includes(name)) {
      errors.push({ sheet: name, row: 0, field: "sheet", reason: `Missing required sheet "${name}"`, severity: "error" });
    }
  }
  for (const [type, name] of Object.entries(SHEET_OF) as [PollType, string][]) {
    if (!wb.SheetNames.includes(name)) continue;
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: "", raw: true });
    const header = rows.length ? Object.keys(rows[0]) : (XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false })[0] as string[] | undefined) ?? [];
    headers[type] = header;
    for (const req of REQUIRED) {
      if (!header.includes(req)) errors.push({ sheet: name, row: 1, field: req, reason: "Required column missing", severity: "error" });
    }
    out[type] = rows;
  }
  return { sheets: out, headers, errors };
}

/** Validate one sheet's rows against the maintained rules. */
export function validateSheet(sheetName: string, rows: Row[]): SheetValidation {
  const seen = new Set<string>();
  const issues: RowIssue[] = [];
  let valid = 0, blank = 0, invalid = 0, recorded = 0, estimated = 0, unknownDistrict = 0;
  rows.forEach((row, i) => {
    const rowNo = i + 2; // Excel row (1 = header)
    const status = partyStatus(row["Party"]);
    if (status === "valid") valid++;
    else if (status === "blank") blank++;
    else invalid++;

    if (status !== "valid") return;

    if (!isRecordedDistrict(row) && estimatedDistrictOf(row) === "") {
      issues.push({ sheet: sheetName, row: rowNo, field: "District", reason: "Valid response with no recorded or estimated district", severity: "warning" });
    }
    if (isRecordedDistrict(row)) {
      recorded++;
      const d = recordedDistrictOf(row);
      if (d && !DISTRICT_NAMES.has(d)) { unknownDistrict++; issues.push({ sheet: sheetName, row: rowNo, field: "District", reason: `Unknown district "${d}"`, severity: "warning" }); }
    } else if (estimatedDistrictOf(row)) {
      estimated++;
      const d = estimatedDistrictOf(row);
      if (d && !DISTRICT_NAMES.has(d)) { unknownDistrict++; issues.push({ sheet: sheetName, row: rowNo, field: "Estimated District", reason: `Unknown district "${d}"`, severity: "warning" }); }
    }

    const id = String(row["Response ID"] ?? "").trim();
    if (!id) issues.push({ sheet: sheetName, row: rowNo, field: "Response ID", reason: "Missing response ID", severity: "error" });
    else if (seen.has(id)) issues.push({ sheet: sheetName, row: rowNo, field: "Response ID", reason: `Duplicate response ID "${id}"`, severity: "error" });
    else seen.add(id);

    const iso = String(row["Entry Datetime ISO"] ?? "").trim();
    if (iso && Number.isNaN(Date.parse(iso))) issues.push({ sheet: sheetName, row: rowNo, field: "Entry Datetime ISO", reason: `Unparseable date "${iso}"`, severity: "warning" });
  });
  return { total: rows.length, valid, blank, invalid, recorded, estimated, unknownDistrict, issues, headers: rows.length ? Object.keys(rows[0]) : [] };
}

/** Build a workbook buffer with both sheets (headers always present). */
export function buildWorkbook(opinion: Row[], exit: Row[], headerUnion?: string[]): Buffer {
  const extra = new Set<string>();
  for (const r of [...opinion, ...exit]) for (const k of Object.keys(r)) if (!(HEADERS as readonly string[]).includes(k)) extra.add(k);
  const cols = [...(headerUnion && headerUnion.length ? headerUnion : HEADERS), ...Array.from(extra).filter((k) => !(HEADERS as readonly string[]).includes(k))];

  const wb = XLSX.utils.book_new();
  for (const [rows, name] of [[opinion, SHEET_OF.opinion], [exit, SHEET_OF.exit]] as [Row[], string][]) {
    const aoa = [cols, ...rows.map((r) => cols.map((c) => r[c] ?? ""))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Force every data cell to a literal string so user text can never be a formula.
    for (const addr of Object.keys(ws)) {
      if (addr[0] === "!") continue;
      const cell = ws[addr];
      if (cell && cell.t !== "n") { cell.t = "s"; cell.v = String(cell.v ?? ""); }
    }
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
