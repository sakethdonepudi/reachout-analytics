import { createHash, randomUUID } from "node:crypto";
import { read, utils } from "xlsx";
import { getMongo } from "@/lib/mongodb";
import { DATA } from "./oct26";

/* =====================================================================
   Telangana October workbook import (tg-oct20-v1).

   The workbook is the source of truth for the raw survey counts; the
   packaged aggregates are the validated numeric snapshot for this exact
   SHA-256. Nothing here evaluates Excel formulas or recomputes the model.

   - Preview reads the Data sheet and reports counts, without writing.
   - Publish is allowed only when the uploaded bytes match the contract
     hash the aggregates were validated against, then atomically activates
     a single import record.
   - Prediction overrides are bound to the same hash/version.
   ===================================================================== */

const DB = process.env.MONGODB_DB || "reachout";
const IMPORTS = "tg_oct26_imports";
const STATE = "tg_oct26_state";
const STATE_ID = "telangana:opinion";

export type Oct26Import = {
  importId: string;
  caseStudy: "telangana";
  pollType: "opinion";
  version: string;
  sourceHash: string;
  filename: string;
  uploader: string;
  at: string;
  outcome: "success" | "failed";
  cutoff: string;
  rows: number;
  distinctEntryIds: number;
  cutoffRows: number;
  answered2028: number;
  blank2028: number;
  answeredRecall2023: number;
  blankRecall2023: number;
  acs: number;
  districts: number;
  overrideVersion: string;
  error?: string;
};

export type Oct26Preview = {
  ok: boolean;
  error?: string;
  sheet: string;
  headers: string[];
  version: string;
  expectedHash: string;
  uploadedHash: string;
  hashMatches: boolean;
  cutoff: string;
  rows: number;
  distinctEntryIds: number;
  cutoffRows: number;
  answered2028: number;
  blank2028: number;
  answeredRecall2023: number;
  blankRecall2023: number;
  acs: number;
  districts: number;
  missingAc: number;
  matchesPackaged: boolean;
  expected: {
    rows: number; cutoffRows: number; answered2028: number; blank2028: number;
    answeredRecall2023: number; blankRecall2023: number; acs: number; districts: number;
  };
  warnings: string[];
};

const EXPECTED = {
  rows: DATA.counts.sourceIds,
  cutoffRows: DATA.counts.cutoffRows,
  answered2028: DATA.counts.answered2028,
  blank2028: DATA.counts.blank2028,
  answeredRecall2023: DATA.counts.answeredRecall2023,
  blankRecall2023: DATA.counts.blankRecall2023,
  acs: DATA.counts.acs,
  districts: DATA.counts.districts,
};

const blank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

function cutoffSerial(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000) + 25_569;
}

export function previewOct26Workbook(buf: Buffer): Oct26Preview {
  const uploadedHash = createHash("sha256").update(buf).digest("hex");
  const base: Oct26Preview = {
    ok: false, sheet: "Data", headers: [],
    version: DATA.version, expectedHash: DATA.sourceHash, uploadedHash,
    hashMatches: uploadedHash === DATA.sourceHash,
    cutoff: DATA.cutoff, rows: 0, distinctEntryIds: 0, cutoffRows: 0,
    answered2028: 0, blank2028: 0, answeredRecall2023: 0, blankRecall2023: 0,
    acs: 0, districts: 0, missingAc: 0, matchesPackaged: false,
    expected: EXPECTED, warnings: [],
  };

  let wb: ReturnType<typeof read>;
  try {
    wb = read(buf, { type: "buffer" });
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "Workbook could not be read" };
  }
  const ws = wb.Sheets["Data"];
  if (!ws) return { ...base, error: 'The workbook has no sheet named "Data"' };

  const rows = utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const col = (row: Record<string, unknown>, name: string) =>
    headers.find((h) => h.trim().toLowerCase() === name.toLowerCase()) ?? name;
  const NEED = ["Entry ID", "Entry Date", "AC No", "District", "2023 Vote", "2028 Vote"];
  const missingCols = NEED.filter((n) => !headers.some((h) => h.trim().toLowerCase() === n.toLowerCase()));
  if (missingCols.length) {
    return { ...base, headers, error: `Missing column(s): ${missingCols.join(", ")}` };
  }

  const cId = col(rows[0], "Entry ID");
  const cDate = col(rows[0], "Entry Date");
  const cAc = col(rows[0], "AC No");
  const cDistrict = col(rows[0], "District");
  const c2023 = col(rows[0], "2023 Vote");
  const c2028 = col(rows[0], "2028 Vote");
  const cutoff = cutoffSerial(DATA.cutoff);

  const ids = new Set<string>();
  const acs = new Set<number>();
  const districts = new Set<string>();
  let cutoffRows = 0, answered2028 = 0, answeredRecall2023 = 0, missingAc = 0;

  for (const r of rows) {
    const id = String(r[cId] ?? "").trim();
    if (id) ids.add(id);
    const ac = Number(r[cAc]);
    if (Number.isInteger(ac) && ac >= 1 && ac <= 119) acs.add(ac); else missingAc += 1;
    const d = String(r[cDistrict] ?? "").trim();
    if (d) districts.add(d);
    const serial = Number(r[cDate]);
    if (!Number.isFinite(serial) || serial < cutoff) continue;
    cutoffRows += 1;
    if (!blank(r[c2028])) answered2028 += 1;
    if (!blank(r[c2023])) answeredRecall2023 += 1;
  }

  const blank2028 = cutoffRows - answered2028;
  const blankRecall2023 = cutoffRows - answeredRecall2023;
  const matchesPackaged =
    rows.length === EXPECTED.rows &&
    cutoffRows === EXPECTED.cutoffRows &&
    answered2028 === EXPECTED.answered2028 &&
    blank2028 === EXPECTED.blank2028 &&
    answeredRecall2023 === EXPECTED.answeredRecall2023 &&
    blankRecall2023 === EXPECTED.blankRecall2023 &&
    acs.size === EXPECTED.acs &&
    districts.size === EXPECTED.districts;

  const warnings: string[] = [];
  if (!base.hashMatches) warnings.push("The file does not match the SHA-256 of the validated workbook. Publish is blocked because the packaged aggregates are bound to that exact version.");
  if (ids.size !== rows.length) warnings.push(`${rows.length - ids.size} duplicate Entry ID(s) found.`);
  if (missingAc) warnings.push(`${missingAc} row(s) have no AC number between 1 and 119.`);
  if (!matchesPackaged) warnings.push("Counts differ from the packaged validated snapshot. Preview only.");
  if (answered2028 === 0) warnings.push("No answered 2028 intentions at the cutoff.");

  return {
    ...base, headers, rows: rows.length, distinctEntryIds: ids.size,
    cutoffRows, answered2028, blank2028, answeredRecall2023, blankRecall2023,
    acs: acs.size, districts: districts.size, missingAc, matchesPackaged, warnings,
    ok: base.hashMatches && matchesPackaged && missingAc === 0,
  };
}

/* ---------------- storage ---------------- */
async function collections() {
  try {
    const promise = getMongo();
    if (!promise) return null;
    const db = (await promise).db(DB);
    return {
      imports: db.collection<Oct26Import>(IMPORTS),
      state: db.collection<{ _id: string; importId: string; at: string }>(STATE),
    };
  } catch {
    // missing or malformed MONGODB_URI: the bundled snapshot still works
    return null;
  }
}

export async function isOct26StoreReady(): Promise<boolean> {
  const c = await collections();
  if (!c) return false;
  try { await c.imports.estimatedDocumentCount(); return true; } catch { return false; }
}

export async function oct26ActiveImport(): Promise<Oct26Import | null> {
  const c = await collections();
  if (!c) return null;
  const state = await c.state.findOne({ _id: STATE_ID });
  if (!state) return null;
  return c.imports.findOne({ importId: state.importId });
}

export async function oct26ImportHistory(limit = 20): Promise<Oct26Import[]> {
  const c = await collections();
  if (!c) return [];
  return c.imports.find({}).sort({ at: -1 }).limit(limit).toArray();
}

export async function publishOct26(opts: {
  buffer: Buffer;
  filename: string;
  uploader: string;
}): Promise<Oct26Import> {
  const at = new Date().toISOString();
  const importId = randomUUID();
  const preview = previewOct26Workbook(opts.buffer);
  const common = {
    importId, caseStudy: "telangana" as const, pollType: "opinion" as const,
    version: DATA.version, sourceHash: preview.uploadedHash, filename: opts.filename,
    uploader: opts.uploader, at, cutoff: DATA.cutoff,
    rows: preview.rows, distinctEntryIds: preview.distinctEntryIds, cutoffRows: preview.cutoffRows,
    answered2028: preview.answered2028, blank2028: preview.blank2028,
    answeredRecall2023: preview.answeredRecall2023, blankRecall2023: preview.blankRecall2023,
    acs: preview.acs, districts: preview.districts,
    overrideVersion: DATA.overrideVersion,
  };
  const c = await collections();
  if (!c) return { ...common, outcome: "failed", error: "Database not configured (MONGODB_URI missing)" };
  if (!preview.ok) {
    await c.imports.insertOne({ ...common, outcome: "failed", error: preview.error ?? preview.warnings[0] ?? "Preview failed" });
    return { ...common, outcome: "failed", error: preview.error ?? preview.warnings[0] ?? "Preview failed" };
  }

  await c.imports.insertOne({ ...common, outcome: "success" });
  try {
    // a single state document is the atomic activation point
    await c.state.updateOne({ _id: STATE_ID }, { $set: { importId, at } }, { upsert: true });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Activation failed";
    await c.imports.updateOne({ importId }, { $set: { outcome: "failed", error } });
    return { ...common, outcome: "failed", error };
  }
  return { ...common, outcome: "success" };
}

export async function revertOct26(actor: string): Promise<{ ok: boolean; error?: string }> {
  const c = await collections();
  if (!c) return { ok: false, error: "Database not configured" };
  await c.state.deleteOne({ _id: STATE_ID });
  const at = new Date().toISOString();
  await c.imports.insertOne({
    importId: randomUUID(), caseStudy: "telangana", pollType: "opinion",
    version: DATA.version, sourceHash: DATA.sourceHash, filename: "bundled-validated-snapshot",
    uploader: actor, at, outcome: "success", cutoff: DATA.cutoff,
    rows: DATA.counts.sourceIds, distinctEntryIds: DATA.counts.sourceIds,
    cutoffRows: DATA.counts.cutoffRows, answered2028: DATA.counts.answered2028,
    blank2028: DATA.counts.blank2028, answeredRecall2023: DATA.counts.answeredRecall2023,
    blankRecall2023: DATA.counts.blankRecall2023, acs: DATA.counts.acs,
    districts: DATA.counts.districts, overrideVersion: DATA.overrideVersion,
    error: "Reverted to the bundled validated snapshot",
  });
  return { ok: true };
}

/** Provenance-only export. Aggregates, not respondent rows; no Entry IDs. */
export function exportOct26Provenance() {
  return {
    caseStudy: "telangana",
    pollType: "opinion",
    version: DATA.version,
    sourceFile: DATA.sourceFile,
    sourceHash: DATA.sourceHash,
    cutoff: DATA.cutoff,
    shrinkFactor: DATA.shrinkFactor,
    parties: DATA.parties,
    congressBasis: DATA.congressBasis,
    othersBasis: DATA.othersBasis,
    overrideVersion: DATA.overrideVersion,
    overrides: DATA.overrides,
    counts: DATA.counts,
    statewide: DATA.statewide,
    districts: DATA.districts,
    acs: DATA.acs,
    devicesAvailable: DATA.devicesAvailable,
    pinDataAvailable: DATA.pinDataAvailable,
    exportedAt: new Date().toISOString(),
  };
}
