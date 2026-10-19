import { createHash, randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import { getMongo } from "@/lib/mongodb";
import baselineJson from "@/lib/data/telangana/baseline.json";
import { canonicalTgParty } from "@/lib/telangana/parties";
import type { AcRecord, AgeRow, Baseline, Counts, DistrictRecord, StatewideRow } from "@/lib/telangana/model";
import { parseAcNumber } from "@/lib/telangana/model";

/* =====================================================================
   Telangana persistence.

   Public aggregates start from the bundled baseline (prepared from the
   supplied pack). When an admin publishes a Telangana scenario import,
   the 2028 counts, age cross-tab and scenario totals are recomputed from
   Mongo and merged with the *bundled* historical + original-entry data.
   Device mix and collection rounds always come from the original 5,090
   entries, never the replicated scenario.

   Collections:
     tg_imports   : import history / versions
     tg_state     : active import per poll type (atomic swap)
     tg_responses : one document per scenario row (provenance preserved)
   ===================================================================== */

const DB = process.env.MONGODB_DB || "reachout";
const CASE_STUDY = "telangana";
const POLL_TYPE = "opinion";
const stateId = `${CASE_STUDY}:${POLL_TYPE}`;

export const HISTORICAL_SOURCE_VERSION = "telangana-historical-2018-2023-v1";
export const ORIGINAL_ENTRY_SOURCE = "Telangana_Original_5090.xlsx (5,090 original entries)";

export type TgImportMeta = {
  importId: string;
  caseStudy: string;
  pollType: string;
  basis: string;
  filename: string;
  uploader: string;
  at: string;
  outcome: "success" | "failed";
  mode: "replace" | "append";
  rows: number;
  answered: number;
  blank: number;
  acs: number;
  groups: number;
  headers: string[];
  error?: string;
};

export type TgAggregates = Baseline & {
  caseStudy: "telangana";
  pollType: "opinion";
  importVersion: string | null;
  importAt: string | null;
  historicalSourceVersion: string;
  originalEntrySource: string;
  denominatorDefinition: { historical: string; survey: string };
};

const base = baselineJson as unknown as Baseline;

function blankAggregates(): TgAggregates {
  return {
    ...base,
    caseStudy: "telangana",
    pollType: "opinion",
    importVersion: null,
    importAt: null,
    historicalSourceVersion: HISTORICAL_SOURCE_VERSION,
    originalEntrySource: ORIGINAL_ENTRY_SOURCE,
    denominatorDefinition: {
      historical: "candidate votes plus NOTA in the same scope",
      survey: "answered 2028 vote questions in the same scope",
    },
  };
}

async function cols() {
  try {
    const p = getMongo();
    if (!p) return null;
    const client = await p;
    const db = client.db(DB);
    return {
      imports: db.collection<TgImportMeta>("tg_imports"),
      state: db.collection<{ _id: string; importId: string; at: string }>("tg_state"),
      rows: db.collection("tg_responses"),
    };
  } catch {
    // A missing/unreachable database must never take the public case study
    // down: reads fall back to the bundled baseline, writes report failure.
    return null;
  }
}

export async function isTelanganaStoreReady() {
  try {
    const p = getMongo();
    if (!p) return false;
    await p;
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 *  Import mapping (header-driven, never positional)
 * ------------------------------------------------------------------ */

export type MappedRow = {
  scenarioRowId: string;
  sourceEntryId: string;
  sourceExcelRow: number;
  recordBasis: string;
  ac: number | null;
  acRaw: string;
  group: string;
  party: string;
  partyRaw: string;
  answered: boolean;
  ageBand: string;
  brand: string;
  pin: string;
  entryDate: string;
  zone: string;
  adjusted2023Raw: string;
  original2023Raw: string;
};

const HEADER = {
  party: "Survey (2028 vote, English)",
  adjusted2023: "2023 adjusted vote (English)",
  original2023: "Original 2023 vote (English)",
  age: "Age",
  ac: "Assembly Constituency",
  pin: "Pincode (IP location field)",
  entryId: "Entry ID",
  entryDate: "Entry Date",
  zone: "Zone",
  brand: "Mobile Brand",
  group: "AC District (from AC column)",
  sourceRow: "Source Excel Row",
  recordBasis: "Record Basis",
};

const AGE_BANDS = ["18–25", "26-35", "36–45", "46–60", "60+"];

function normaliseAge(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "(missing)";
  return AGE_BANDS.includes(s) ? s : "(missing)";
}

export function mapScenarioRow(row: Record<string, unknown>, importId: string, index: number): MappedRow {
  const partyRaw = String(row[HEADER.party] ?? "").trim();
  const answered = partyRaw !== "";
  const acRaw = String(row[HEADER.ac] ?? "").trim();
  const ac = parseAcNumber(acRaw);
  const sourceExcelRow = Number(row[HEADER.sourceRow]) || index + 2;
  const occurrence = index + 1;
  const scenarioRowId = createHash("sha1").update(`${importId}|${sourceExcelRow}|${occurrence}`).digest("hex").slice(0, 24);
  return {
    scenarioRowId,
    sourceEntryId: String(row[HEADER.entryId] ?? "").trim(),
    sourceExcelRow,
    recordBasis: String(row[HEADER.recordBasis] ?? "").trim() || (answered ? "Replicated scenario" : "Replicated; blank 2028"),
    ac,
    acRaw,
    group: String(row[HEADER.group] ?? "").trim(),
    party: answered ? canonicalTgParty(partyRaw) : "",
    partyRaw,
    answered,
    ageBand: normaliseAge(row[HEADER.age]),
    brand: String(row[HEADER.brand] ?? "").trim() || "Unknown",
    pin: String(row[HEADER.pin] ?? "").trim(),
    entryDate: String(row[HEADER.entryDate] ?? "").trim(),
    zone: String(row[HEADER.zone] ?? "").trim(),
    adjusted2023Raw: String(row[HEADER.adjusted2023] ?? "").trim(),
    original2023Raw: String(row[HEADER.original2023] ?? "").trim(),
  };
}

export function parseScenarioWorkbook(buffer: Buffer | ArrayBuffer): { rows: Record<string, unknown>[]; headers: string[]; sheet: string } {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.SheetNames.find((n) => /opinion poll/i.test(n)) ?? wb.SheetNames.find((n) => /data/i.test(n)) ?? wb.SheetNames[0];
  if (!sheet) throw new Error("Workbook has no sheet");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheet], { defval: "", raw: true });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  for (const required of [HEADER.party, HEADER.ac]) {
    if (!headers.includes(required)) throw new Error(`Required column missing: "${required}" (the mapper reads headers, not positions)`);
  }
  return { rows, headers, sheet };
}

/* ------------------------------------------------------------------ *
 *  Read aggregates (Mongo import if present, else bundled baseline)
 * ------------------------------------------------------------------ */

export async function loadTelanganaAggregates(): Promise<TgAggregates> {
  const bundled = blankAggregates();
  const c = await cols();
  if (!c) return bundled;
  const state = await c.state.findOne({ _id: stateId });
  if (!state?.importId) return bundled;

  const groups = await c.rows.aggregate([
    { $match: { importId: state.importId } },
    { $group: {
      _id: { ac: "$ac", party: "$party", answered: "$answered", age: "$ageBand" },
      n: { $sum: 1 },
    } },
  ]).toArray() as { _id: { ac: number | null; party: string; answered: boolean; age: string }; n: number }[];

  if (!groups.length) return bundled;

  // per-AC 2028 counts, age cross-tab and totals
  const acMap = new Map<number, { a2028: Counts; answered: number; rows: number }>();
  const ageMap = new Map<string, Counts>();
  let answeredTotal = 0, rowTotal = 0;

  for (const g of groups) {
    const ac = g._id.ac ?? 0;
    rowTotal += g.n;
    const rec = acMap.get(ac) ?? { a2028: {}, answered: 0, rows: 0 };
    rec.rows += g.n;
    if (g._id.answered && g._id.party) {
      rec.a2028[g._id.party] = (rec.a2028[g._id.party] ?? 0) + g.n;
      rec.answered += g.n;
      answeredTotal += g.n;
      const age = g._id.age || "(missing)";
      const bucket = ageMap.get(age) ?? {};
      bucket[g._id.party] = (bucket[g._id.party] ?? 0) + g.n;
      ageMap.set(age, bucket);
    }
    acMap.set(ac, rec);
  }

  // merge onto the bundled records (historical + original-entry data stay)
  const acs: AcRecord[] = bundled.acs.map((a) => {
    const dyn = acMap.get(a.no);
    if (!dyn) return { ...a, a2028: {}, answered2028: 0, scenarioRows: 0 };
    return {
      ...a,
      a2028: dyn.a2028,
      answered2028: dyn.answered,
      scenarioRows: dyn.rows,
    };
  });

  const groupsOut: DistrictRecord[] = bundled.districts.map((d) => {
    const members = acs.filter((a) => a.group === d.group);
    const a2028: Counts = {};
    let answered = 0, rows = 0;
    for (const m of members) {
      for (const [p, n] of Object.entries(m.a2028)) a2028[p] = (a2028[p] ?? 0) + n;
      answered += m.answered2028;
      rows += m.scenarioRows;
    }
    return { ...d, a2028, answered2028: answered, acs: members.map((m) => m.no) };
  });

  const parties = bundled.partyOrder;
  const statewide: StatewideRow[] = bundled.statewide.map((row) => {
    let count = 0;
    for (const a of acs) count += a.a2028[row.party] ?? 0;
    return {
      ...row,
      answered2028: count,
      share2028: answeredTotal > 0 ? count / answeredTotal : 0,
      diff2023to2028: answeredTotal > 0 ? (count / answeredTotal) * 100 - row.s2023 * 100 : 0,
    };
  });

  const age: AgeRow[] = [...ageMap.entries()].map(([band, partiesCounts]) => ({
    band,
    answered: parties.reduce((s, p) => s + (partiesCounts[p] ?? 0), 0),
    parties: partiesCounts,
  }));
  // keep a stable order, including bands that are absent in the import
  const ORDER = ["18–25", "26-35", "36–45", "46–60", "60+", "(missing)"];
  age.sort((a, b) => ORDER.indexOf(a.band) - ORDER.indexOf(b.band));

  return {
    ...bundled,
    totals: {
      ...bundled.totals,
      scenarioRows: rowTotal,
      answered2028: answeredTotal,
      blank2028: rowTotal - answeredTotal,
    },
    acs,
    districts: groupsOut,
    statewide,
    age,
    importVersion: state.importId,
    importAt: state.at,
  };
}

/* ------------------------------------------------------------------ *
 *  Preview (no writes)
 * ------------------------------------------------------------------ */

export type TgPreview = {
  ok: boolean;
  error?: string;
  sheet: string;
  headers: string[];
  rows: number;
  answered: number;
  blank: number;
  acs: number;
  groups: number;
  byParty: Record<string, number>;
  missingAc: number;
  missingGroup: number;
  duplicatedSourceRows: number;
  adjusted2023Present: number;
  warnings: string[];
  expected: { rows: number; answered: number; blank: number };
};

export function previewTelanganaScenario(buffer: Buffer | ArrayBuffer): TgPreview {
  const expected = { rows: base.totals.scenarioRows, answered: base.totals.answered2028, blank: base.totals.blank2028 };
  const empty: TgPreview = {
    ok: false, sheet: "", headers: [], rows: 0, answered: 0, blank: 0, acs: 0, groups: 0, byParty: {},
    missingAc: 0, missingGroup: 0, duplicatedSourceRows: 0, adjusted2023Present: 0, warnings: [], expected,
  };
  let parsed: ReturnType<typeof parseScenarioWorkbook>;
  try { parsed = parseScenarioWorkbook(buffer); }
  catch (e) { return { ...empty, error: e instanceof Error ? e.message : "Workbook could not be read" }; }

  const mapped = parsed.rows.map((r, i) => mapScenarioRow(r, "preview", i));
  const byParty: Record<string, number> = {};
  let answered = 0, missingAc = 0, missingGroup = 0, adjusted = 0;
  const seenSourceRows = new Map<number, number>();
  for (const r of mapped) {
    if (r.answered) { answered++; byParty[r.party] = (byParty[r.party] ?? 0) + 1; }
    if (r.ac === null) missingAc++;
    if (!r.group) missingGroup++;
    if (r.adjusted2023Raw) adjusted++;
    seenSourceRows.set(r.sourceExcelRow, (seenSourceRows.get(r.sourceExcelRow) ?? 0) + 1);
  }
  let duplicatedSourceRows = 0;
  for (const n of seenSourceRows.values()) if (n > 1) duplicatedSourceRows += n;

  const warnings: string[] = [];
  if (mapped.length !== expected.rows) warnings.push(`Row count ${mapped.length} differs from the supplied scenario (${expected.rows}).`);
  if (answered !== expected.answered) warnings.push(`Answered 2028 rows ${answered} differ from the supplied scenario (${expected.answered}).`);
  if (duplicatedSourceRows) warnings.push(`${duplicatedSourceRows.toLocaleString("en-IN")} of ${mapped.length.toLocaleString("en-IN")} rows repeat a source Excel row — expected for the replicated scenario; they are repetitions, not new respondents.`);
  if (adjusted) warnings.push(`${adjusted} rows carry adjusted 2023 values; these are preserved as provenance and are never used as the 2028 party or a historical baseline.`);

  return {
    ok: missingAc === 0,
    sheet: parsed.sheet,
    headers: parsed.headers,
    rows: mapped.length,
    answered,
    blank: mapped.length - answered,
    acs: new Set(mapped.map((r) => r.ac)).size,
    groups: new Set(mapped.map((r) => r.group)).size,
    byParty,
    missingAc,
    missingGroup,
    duplicatedSourceRows,
    adjusted2023Present: adjusted,
    warnings,
    expected,
  };
}

/* ------------------------------------------------------------------ *
 *  Publish (atomic)
 * ------------------------------------------------------------------ */

export async function publishTelanganaScenario(opts: {
  buffer: Buffer | ArrayBuffer;
  filename: string;
  uploader: string;
  mode: "replace" | "append";
}): Promise<TgImportMeta> {
  const at = new Date().toISOString();
  const importId = randomUUID();
  const c = await cols();
  const fail = (error: string): TgImportMeta => ({
    importId, caseStudy: CASE_STUDY, pollType: POLL_TYPE, basis: "replicated-adjusted-scenario",
    filename: opts.filename, uploader: opts.uploader, at, outcome: "failed", mode: opts.mode,
    rows: 0, answered: 0, blank: 0, acs: 0, groups: 0, headers: [], error,
  });
  if (!c) return fail("Database not configured (MONGODB_URI missing)");

  let parsed: ReturnType<typeof parseScenarioWorkbook>;
  try { parsed = parseScenarioWorkbook(opts.buffer); }
  catch (e) { return fail(e instanceof Error ? e.message : "Workbook could not be read"); }

  const mapped = parsed.rows.map((r, i) => mapScenarioRow(r, importId, i));
  const missingAc = mapped.filter((r) => r.ac === null).length;
  if (missingAc > 0) return fail(`${missingAc} rows have no leading AC number in "${HEADER.ac}"`);

  try {
    for (let i = 0; i < mapped.length; i += 2000) {
      const chunk = mapped.slice(i, i + 2000).map((r) => ({ ...r, importId, caseStudy: CASE_STUDY, pollType: POLL_TYPE, basis: "replicated-adjusted-scenario" }));
      await c.rows.insertMany(chunk, { ordered: true });
    }
    // only now does the dataset become active — a failed insert leaves the old one live
    await c.state.updateOne({ _id: stateId }, { $set: { importId, at } }, { upsert: true });
    const answered = mapped.filter((r) => r.answered).length;
    const meta: TgImportMeta = {
      importId, caseStudy: CASE_STUDY, pollType: POLL_TYPE, basis: "replicated-adjusted-scenario",
      filename: opts.filename, uploader: opts.uploader, at, outcome: "success", mode: opts.mode,
      rows: mapped.length, answered, blank: mapped.length - answered,
      acs: new Set(mapped.map((r) => r.ac)).size,
      groups: new Set(mapped.map((r) => r.group)).size,
      headers: parsed.headers,
    };
    await c.imports.insertOne(meta);
    return meta;
  } catch (e) {
    // best-effort cleanup so a failed attempt cannot be activated later
    await c.rows.deleteMany({ importId }).catch(() => {});
    const meta = fail(e instanceof Error ? e.message : "insert failed");
    await c.imports.insertOne(meta).catch(() => {});
    return meta;
  }
}

export async function revertToBundled(actor: string): Promise<TgImportMeta> {
  const c = await cols();
  const at = new Date().toISOString();
  if (c) await c.state.deleteOne({ _id: stateId });
  const meta: TgImportMeta = {
    importId: "bundled-baseline", caseStudy: CASE_STUDY, pollType: POLL_TYPE, basis: "bundled-baseline",
    filename: "bundled baseline", uploader: actor, at, outcome: "success", mode: "replace",
    rows: base.totals.scenarioRows, answered: base.totals.answered2028, blank: base.totals.blank2028,
    acs: base.totals.acs, groups: base.totals.groups, headers: [],
  };
  if (c) await c.imports.insertOne(meta).catch(() => {});
  return meta;
}

export async function telanganaImportHistory(limit = 20): Promise<TgImportMeta[]> {
  const c = await cols();
  if (!c) return [];
  return c.imports.find({ caseStudy: CASE_STUDY }).sort({ at: -1 }).limit(limit).toArray();
}

/* ------------------------------------------------------------------ *
 *  Export (preserves provenance; admin only)
 * ------------------------------------------------------------------ */

export async function exportTelanganaScenario(): Promise<Buffer> {
  const c = await cols();
  const state = c ? await c.state.findOne({ _id: stateId }) : null;
  const wb = XLSX.utils.book_new();
  const header = [
    "Import ID", "Scenario Row ID", "Source Entry ID", "Source Excel Row", "Record Basis",
    "AC Number", "AC (raw)", "AC District (from AC column)", "2028 Party", "2028 Party (raw)",
    "Answered 2028", "Age", "Mobile Brand", "Pincode (IP location field)", "Entry Date", "Zone",
    "2023 adjusted vote (English) — not a baseline", "Original 2023 vote (English)",
  ];
  let rows: unknown[][] = [];
  if (c && state?.importId) {
    const docs = await c.rows.find({ importId: state.importId }).sort({ sourceExcelRow: 1 }).toArray();
    rows = docs.map((d) => {
      const r = d as unknown as MappedRow;
      return [
        state.importId, r.scenarioRowId, r.sourceEntryId, r.sourceExcelRow, r.recordBasis,
        r.ac, r.acRaw, r.group, r.party, r.partyRaw, r.answered ? "Yes" : "No",
        r.ageBand, r.brand, r.pin, r.entryDate, r.zone, r.adjusted2023Raw, r.original2023Raw,
      ];
    });
  } else {
    rows = [[
      "bundled-baseline", "", "", "", "Bundled baseline (no admin import)",
      "", "", "", "", "", "", "", "", "", "", "", "", "",
    ]];
  }
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  for (const addr of Object.keys(ws)) {
    if (addr[0] === "!") continue;
    const cell = ws[addr];
    if (cell && cell.t !== "n") { cell.t = "s"; cell.v = String(cell.v ?? ""); }
  }
  XLSX.utils.book_append_sheet(wb, ws, "Telangana scenario export");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
