import { randomUUID } from "node:crypto";
import { getMongo } from "@/lib/mongodb";
import { partyStatus, isRecordedDistrict, estimatedDistrictOf, recordedDistrictOf, scenarioDistrictOf, type PollType, type Row } from "@/lib/poll-data";
import { resolveRowPin, pinLocationRef, normalizePin, isSixDigitPin } from "@/lib/pin";
import { assignPinForRecord, summarizeAssignments, type PinAssignmentRow, type PinAssignmentSummary } from "@/lib/pin-assign";

/* =====================================================================
   Persistent poll datasets in MongoDB, scoped by caseStudyId + pollType.

   - poll_responses : one document per response row (+ caseStudyId, importId)
   - poll_imports   : import history / dataset versions
   - poll_state     : active import per (caseStudyId, pollType) — atomic swap
   ===================================================================== */

export type Counts = { total: number; valid: number; blank: number; invalid: number; recorded: number; estimated: number };

export type ImportMeta = {
  importId: string;
  caseStudyId: string;
  pollType: PollType;
  filename: string;
  uploader: string;
  at: string;
  outcome: "success" | "failed";
  mode: "append" | "replace";
  inserted: number;
  skipped: number;
  counts: Counts;
  headers: string[];
  error?: string;
};

const DB = process.env.MONGODB_DB || "reachout";
const stateId = (caseStudyId: string, pollType: PollType) => `${caseStudyId}:${pollType}`;

async function cols() {
  const p = getMongo();
  if (!p) return null;
  const client = await p;
  const db = client.db(DB);
  return {
    responses: db.collection("poll_responses"),
    imports: db.collection<ImportMeta>("poll_imports"),
    state: db.collection<{ _id: string; caseStudyId: string; pollType: PollType; activeImportId: string }>("poll_state"),
  };
}

export async function isConfigured() {
  return getMongo() !== null;
}

/** Tag pre-scoping (legacy) rows with a caseStudyId — preserves existing data. */
export async function migrateLegacyToCase(caseStudyId: string) {
  const c = await cols();
  if (!c) return { responses: 0, imports: 0, state: 0 };
  const r = await c.responses.updateMany({ caseStudyId: { $exists: false } }, { $set: { caseStudyId } });
  const i = await c.imports.updateMany({ caseStudyId: { $exists: false } }, { $set: { caseStudyId } });
  const legacyState = await c.state.find({ caseStudyId: { $exists: false } }).toArray();
  for (const s of legacyState) {
    const pt = (s.pollType ?? (s._id as unknown as PollType)) as PollType;
    await c.state.updateOne(
      { _id: stateId(caseStudyId, pt) },
      { $set: { caseStudyId, pollType: pt, activeImportId: s.activeImportId } },
      { upsert: true },
    );
    await c.state.deleteOne({ _id: s._id });
  }
  return { responses: r.modifiedCount, imports: i.modifiedCount, state: legacyState.length };
}

export async function ensureIndexes() {
  const c = await cols();
  if (!c) return;
  await c.responses.createIndex({ caseStudyId: 1, pollType: 1, importId: 1, responseId: 1 }, { unique: true, sparse: true }).catch(() => {});
  await c.responses.createIndex({ caseStudyId: 1, pollType: 1, importId: 1, pinNormalized: 1 }).catch(() => {});
}

export async function getActiveImportId(caseStudyId: string, pollType: PollType): Promise<string | null> {
  const c = await cols();
  if (!c) return null;
  const s = await c.state.findOne({ _id: stateId(caseStudyId, pollType) });
  return s?.activeImportId ?? null;
}

async function recordImport(meta: ImportMeta) {
  const c = await cols();
  if (c) await c.imports.insertOne(meta);
}

/** Exported for the PIN audit test — the exact mapper used when storing rows. */
export function toDoc(row: Row, caseStudyId: string, pollType: PollType, importId: string) {
  const status = partyStatus(row["Party"]);
  // Canonical PIN resolution is repeated server-side so the chunked
  // (browser-parsed) path can never diverge from the multipart path.
  const pin = resolveRowPin(row);
  const pinRef = pin.format === "ok" ? pinLocationRef(pin.normalized) : { known: false, district: null as string | null };
  return {
    caseStudyId,
    pollType,
    importId,
    responseId: String(row["Response ID"] ?? ""),
    survey: String(row["Survey"] ?? ""),
    state: String(row["State"] ?? ""),
    district: recordedDistrictOf(row),
    ac: String(row["Assembly Constituency"] ?? ""),
    // PIN is always stored as text; raw (cleaned) value + normalised digits + format.
    pin: pin.value,
    pinNormalized: pin.normalized,
    pinFormat: pin.format,
    pinConflict: pin.conflict,
    pinRefDistrict: pinRef.district ?? "",
    pinLocationKnown: pinRef.known,
    party: String(row["Party"] ?? ""),
    status,
    partyValid: status === "valid",
    entryIso: String(row["Entry Datetime ISO"] ?? row["Entry Date Original"] ?? ""),
    zone: String(row["Zone"] ?? ""),
    sourceZone: String(row["Zone"] ?? ""),
    geographyBasis: String(row["Geography Basis"] ?? ""),
    recorded: isRecordedDistrict(row),
    estimatedDistrict: estimatedDistrictOf(row),
    scenarioDistrict: scenarioDistrictOf(row),
    row,
  };
}

export function countRows(rows: Row[]): Counts {
  let valid = 0, blank = 0, invalid = 0, recorded = 0, estimated = 0;
  for (const r of rows) {
    const s = partyStatus(r["Party"]);
    if (s === "valid") valid++; else if (s === "blank") blank++; else invalid++;
    if (s === "valid") { if (isRecordedDistrict(r)) recorded++; else if (estimatedDistrictOf(r)) estimated++; }
  }
  return { total: rows.length, valid, blank, invalid, recorded, estimated };
}

export async function prepareImportId(caseStudyId: string, pollType: PollType, mode: "append" | "replace", importId?: string): Promise<string> {
  if (importId) return importId;
  if (mode === "append") { const active = await getActiveImportId(caseStudyId, pollType); if (active) return active; }
  return randomUUID();
}

export async function insertRowsRaw(caseStudyId: string, pollType: PollType, importId: string, rows: Row[]): Promise<number> {
  const c = await cols();
  if (!c || rows.length === 0) return 0;
  await ensureIndexes();
  const docs = rows.map((r, i) => {
    const d = toDoc(r, caseStudyId, pollType, importId);
    if (!d.responseId) d.responseId = `${importId}-${i}`;
    return d;
  });
  try {
    const res = await c.responses.insertMany(docs, { ordered: false });
    return res.insertedCount;
  } catch (e) {
    const err = e as { insertedCount?: number; result?: { nInserted?: number } };
    return err.insertedCount ?? err.result?.nInserted ?? 0;
  }
}

export async function finalizeImport(opts: {
  caseStudyId: string; pollType: PollType; importId: string; mode: "append" | "replace"; filename: string; uploader: string; headers: string[]; inserted: number;
}): Promise<ImportMeta | null> {
  const c = await cols();
  if (!c) return null;
  // Activate only on the final chunk; verify the dataset is complete first.
  if (opts.mode === "replace") {
    await c.state.updateOne({ _id: stateId(opts.caseStudyId, opts.pollType) }, { $set: { caseStudyId: opts.caseStudyId, pollType: opts.pollType, activeImportId: opts.importId } }, { upsert: true });
  }
  const s = await summary(opts.caseStudyId, opts.pollType);
  const meta: ImportMeta = {
    importId: opts.importId, caseStudyId: opts.caseStudyId, pollType: opts.pollType, filename: opts.filename, uploader: opts.uploader,
    at: new Date().toISOString(), outcome: "success", mode: opts.mode, inserted: opts.inserted, skipped: 0,
    counts: s?.counts ?? { total: 0, valid: 0, blank: 0, invalid: 0, recorded: 0, estimated: 0 },
    headers: opts.headers,
  };
  await recordImport(meta);
  return meta;
}

/** Multipart import (small files only). */
export async function importDataset(opts: {
  caseStudyId: string; pollType: PollType; rows: Row[]; filename: string; uploader: string; mode: "append" | "replace"; headers: string[];
}): Promise<ImportMeta> {
  const { caseStudyId, pollType, rows, filename, uploader, mode, headers } = opts;
  const counts = countRows(rows);
  const at = new Date().toISOString();
  const c = await cols();
  if (!c) return { importId: randomUUID(), caseStudyId, pollType, filename, uploader, at, outcome: "failed", mode, inserted: 0, skipped: 0, counts, headers, error: "Database not configured (MONGODB_URI missing)" };

  const existingImportId = mode === "append" ? await getActiveImportId(caseStudyId, pollType) : null;
  let skipIds = new Set<string>();
  if (existingImportId) {
    const existing = await c.responses.find({ caseStudyId, pollType, importId: existingImportId }).project({ responseId: 1 }).toArray();
    skipIds = new Set(existing.map((d) => d.responseId));
  }
  const importId = existingImportId ?? randomUUID();
  const docs = rows.filter((r, i) => {
    const id = String(r["Response ID"] ?? "").trim() || `__row${i}`;
    if (skipIds.has(id)) return false;
    skipIds.add(id);
    return true;
  }).map((r) => toDoc(r, caseStudyId, pollType, importId));
  const skipped = rows.length - docs.length;
  try {
    for (let i = 0; i < docs.length; i += 2000) await c.responses.insertMany(docs.slice(i, i + 2000), { ordered: true });
    await c.state.updateOne({ _id: stateId(caseStudyId, pollType) }, { $set: { caseStudyId, pollType, activeImportId: importId } }, { upsert: true });
    const meta: ImportMeta = { importId, caseStudyId, pollType, filename, uploader, at, outcome: "success", mode, inserted: docs.length, skipped, counts, headers };
    await recordImport(meta);
    return meta;
  } catch (e) {
    const meta: ImportMeta = { importId, caseStudyId, pollType, filename, uploader, at, outcome: "failed", mode, inserted: 0, skipped, counts, headers, error: e instanceof Error ? e.message : "insert failed" };
    await recordImport(meta);
    return meta;
  }
}

export async function summary(caseStudyId: string, pollType: PollType) {
  const c = await cols();
  if (!c) return null;
  const importId = await getActiveImportId(caseStudyId, pollType);
  if (!importId) return { caseStudyId, pollType, importId: null, counts: { total: 0, valid: 0, blank: 0, invalid: 0, recorded: 0, estimated: 0 }, asOf: null };
  const agg = await c.responses.aggregate([
    { $match: { caseStudyId, pollType, importId } },
    { $group: {
      _id: null,
      total: { $sum: 1 },
      valid: { $sum: { $cond: [{ $eq: ["$status", "valid"] }, 1, 0] } },
      blank: { $sum: { $cond: [{ $eq: ["$status", "blank"] }, 1, 0] } },
      invalid: { $sum: { $cond: [{ $eq: ["$status", "invalid"] }, 1, 0] } },
      recorded: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "valid"] }, "$recorded"] }, 1, 0] } },
      estimated: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "valid"] }, { $ne: ["$estimatedDistrict", ""] }] }, 1, 0] } },
    } },
  ]).toArray();
  const counts = (agg[0] ?? { total: 0, valid: 0, blank: 0, invalid: 0, recorded: 0, estimated: 0 }) as Counts & { _id?: unknown };
  delete counts._id;
  const latest = await c.imports.find({ caseStudyId, pollType, importId }).sort({ at: -1 }).limit(1).toArray();
  return { caseStudyId, pollType, importId, counts, asOf: latest[0]?.at ?? null };
}

export async function partyShares(caseStudyId: string, pollType: PollType, scenario = false) {
  const c = await cols();
  if (!c) return { denominator: 0, shares: [] as { party: string; count: number; pct: number }[] };
  const importId = await getActiveImportId(caseStudyId, pollType);
  if (!importId) return { denominator: 0, shares: [] };
  const rows = await c.responses.aggregate([
    { $match: { caseStudyId, pollType, importId, status: "valid", ...(scenario ? { recorded: false } : {}) } },
    { $group: { _id: "$party", count: { $sum: 1 } } },
  ]).toArray();
  const denominator = rows.reduce((a, r) => a + (r.count as number), 0);
  const shares = rows
    .map((r) => ({ party: r._id as string, count: r.count as number, pct: denominator ? +((r.count / denominator) * 100).toFixed(2) : 0 }))
    .sort((a, b) => b.count - a.count);
  return { denominator, shares };
}

/** Pure Mongo query builder for the admin records list (PIN filter included). */
export function buildRecordsQuery(caseStudyId: string, pollType: PollType, importId: string, filters: Record<string, string>) {
  const q: Record<string, unknown> = { caseStudyId, pollType, importId };
  if (filters.party) q.party = filters.party;
  if (filters.status) q.status = filters.status;
  if (filters.geographyBasis) q.geographyBasis = filters.geographyBasis;
  if (filters.pin) q.pinNormalized = normalizePin(filters.pin);
  if (filters.district) q.$or = [{ district: filters.district }, { estimatedDistrict: filters.district }, { scenarioDistrict: filters.district }];
  if (filters.q) q.responseId = { $regex: filters.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  return q;
}

export async function listRecords(caseStudyId: string, pollType: PollType, filters: Record<string, string>, limit = 100, skip = 0) {
  const c = await cols();
  if (!c) return { records: [] as Row[], total: 0 };
  const importId = await getActiveImportId(caseStudyId, pollType);
  if (!importId) return { records: [], total: 0 };
  const q = buildRecordsQuery(caseStudyId, pollType, importId, filters);
  const total = await c.responses.countDocuments(q);
  const docs = await c.responses.find(q).skip(skip).limit(limit).toArray();
  return { records: docs.map((d) => d.row as Row), total };
}

export async function history(caseStudyId: string | null, limit = 25) {
  const c = await cols();
  if (!c) return [];
  const q = caseStudyId ? { caseStudyId } : {};
  return c.imports.find(q).sort({ at: -1 }).limit(limit).project({ _id: 0 }).toArray();
}

export type DistrictAgg = { district: string; total: number; valid: number; parties: Record<string, number> };

/**
 * Per-district aggregates for the selected case study + poll type.
 * Recorded geography uses `District`; the estimated scenario groups valid
 * responses by `District for Scenario`. Party counts use valid responses only.
 */
export async function districtAggregates(caseStudyId: string, pollType: PollType, scenario = false) {
  const c = await cols();
  const empty = { districts: [] as DistrictAgg[], total: 0, valid: 0, byParty: {} as Record<string, number> };
  if (!c) return empty;
  const importId = await getActiveImportId(caseStudyId, pollType);
  if (!importId) return empty;

  const groupField = scenario ? { $ifNull: ["$scenarioDistrict", "$estimatedDistrict"] } : "$district";
  const match: Record<string, unknown> = { caseStudyId, pollType, importId };
  if (!scenario) match.recorded = true;

  const rows = await c.responses.aggregate([
    { $match: match },
    { $group: { _id: { d: groupField, status: "$status", party: "$party" }, n: { $sum: 1 } } },
  ]).toArray();

  const map = new Map<string, DistrictAgg>();
  let total = 0, valid = 0;
  const byParty: Record<string, number> = {};
  for (const r of rows) {
    const g = r._id as { d?: string; status?: string; party?: string };
    const n = r.n as number;
    total += n;
    const name = (g.d ?? "").trim();
    const key = name || "__unmapped__";
    const d = map.get(key) ?? { district: name, total: 0, valid: 0, parties: {} };
    d.total += n;
    if (g.status === "valid") {
      d.valid += n; valid += n;
      const p = g.party || "Unknown";
      d.parties[p] = (d.parties[p] ?? 0) + n;
      byParty[p] = (byParty[p] ?? 0) + n;
    }
    map.set(key, d);
  }
  return { districts: [...map.values()], total, valid, byParty };
}

/* =====================================================================
   PIN-code aggregates — scoped to case study + poll type + active
   (published) import + geography basis. Only six-digit-valid PINs become
   filter buckets; responses without a PIN stay in the totals.
   ===================================================================== */

export type PinAgg = {
  pin: string;
  total: number;
  valid: number;
  parties: Record<string, number>;
  districts: Record<string, number>;
};
export type PinGroupRow = { _id: { pin?: string; status?: string; party?: string; district?: string }; n: number };
export type PinAggregates = {
  pins: PinAgg[];
  total: number;
  valid: number;
  withPin: number;
  withoutPin: number;
  invalidPinResponses: number;
};

/** Pure assembly step — unit-testable without a database. */
export function assemblePinAggregates(rows: PinGroupRow[]): PinAggregates {
  let total = 0, valid = 0, withPin = 0, invalidPinResponses = 0;
  const map = new Map<string, PinAgg>();
  for (const r of rows) {
    const g = r._id ?? {};
    const n = r.n;
    total += n;
    const isValid = g.status === "valid";
    if (isValid) valid += n;
    const pin = normalizePin(g.pin ?? "");
    if (!pin) continue; // no PIN — stays in totals, not in any bucket
    withPin += n;
    if (!isSixDigitPin(pin)) { invalidPinResponses += n; continue; }
    const d = map.get(pin) ?? { pin, total: 0, valid: 0, parties: {}, districts: {} };
    d.total += n;
    if (isValid) {
      d.valid += n;
      const p = g.party || "Unknown";
      d.parties[p] = (d.parties[p] ?? 0) + n;
      if (g.district) d.districts[g.district] = (d.districts[g.district] ?? 0) + n;
    }
    map.set(pin, d);
  }
  const pins = [...map.values()].sort((a, b) => b.valid - a.valid || b.total - a.total || a.pin.localeCompare(b.pin));
  return { pins, total, valid, withPin, withoutPin: total - withPin, invalidPinResponses };
}

/** Assumed-PIN aggregates (grouped by the scenario "Assumed PIN Code"). */
export async function assumedPinAggregates(caseStudyId: string, pollType: PollType): Promise<PinAggregates> {
  const c = await cols();
  const empty: PinAggregates = { pins: [], total: 0, valid: 0, withPin: 0, withoutPin: 0, invalidPinResponses: 0 };
  if (!c) return empty;
  const importId = await getActiveImportId(caseStudyId, pollType);
  if (!importId) return empty;
  const rows = (await c.responses.aggregate([
    { $match: { caseStudyId, pollType, importId, assumedPin: { $ne: "" } } },
    { $group: { _id: { pin: "$assumedPin", status: "$status", party: "$party", district: { $ifNull: ["$district", "$scenarioDistrict"] } }, n: { $sum: 1 } } },
  ]).toArray()) as PinGroupRow[];
  return assemblePinAggregates(rows);
}

/* =====================================================================
   Assumed-PIN scenario — preview (read-only) and commit.
   ===================================================================== */

async function scenarioCol() {
  const p = getMongo();
  if (!p) return null;
  const client = await p;
  return client.db(DB).collection<{ _id: string; caseStudyId: string; pollType: PollType; importId: string; appliedAt: string; summary: PinAssignmentSummary }>("poll_scenarios");
}

async function assignmentRows(caseStudyId: string, pollType: PollType, importId: string): Promise<PinAssignmentRow[]> {
  const c = await cols();
  if (!c) return [];
  const docs = await c.responses
    .find({ caseStudyId, pollType, importId })
    .project({ _id: 0, responseId: 1, pin: 1, district: 1, estimatedDistrict: 1, scenarioDistrict: 1, status: 1, party: 1 })
    .toArray();
  return docs.map((d) => ({
    responseId: String(d.responseId ?? ""),
    pin: d.pin,
    recordedDistrict: String(d.district ?? ""),
    estimatedDistrict: String(d.estimatedDistrict ?? ""),
    scenarioDistrict: String(d.scenarioDistrict ?? ""),
    status: d.status,
    party: d.party,
  }));
}

export type PinAssignmentPreview = {
  ok: boolean;
  reason?: string;
  importId: string | null;
  summary: PinAssignmentSummary;
  /** Current statewide counts — shown alongside to prove they are unchanged. */
  baseline: { total: number; valid: number; shares: { party: string; count: number; pct: number }[] };
  asOf: string | null;
};

/** Read-only preview of the assumed-PIN assignment (writes nothing). */
export async function previewPinAssignment(caseStudyId: string, pollType: PollType): Promise<PinAssignmentPreview> {
  const c = await cols();
  if (!c) return { ok: false, reason: "Database not configured", importId: null, summary: summarizeAssignments([]), baseline: { total: 0, valid: 0, shares: [] }, asOf: null };
  const importId = await getActiveImportId(caseStudyId, pollType);
  if (!importId) return { ok: false, reason: "No active import", importId: null, summary: summarizeAssignments([]), baseline: { total: 0, valid: 0, shares: [] }, asOf: null };
  const [rows, sum, shares] = await Promise.all([
    assignmentRows(caseStudyId, pollType, importId),
    summary(caseStudyId, pollType),
    partyShares(caseStudyId, pollType),
  ]);
  return {
    ok: true,
    importId,
    summary: summarizeAssignments(rows),
    baseline: { total: sum?.counts.total ?? 0, valid: sum?.counts.valid ?? 0, shares: shares.shares },
    asOf: sum?.asOf ?? null,
  };
}

/** Commit the assumed-PIN scenario to storage and the embedded export row. */
export async function applyPinAssignment(caseStudyId: string, pollType: PollType): Promise<PinAssignmentPreview> {
  const c = await cols();
  const preview = await previewPinAssignment(caseStudyId, pollType);
  if (!c || !preview.ok || !preview.importId) return preview;
  const importId = preview.importId;

  const docs = await c.responses
    .find({ caseStudyId, pollType, importId })
    .project({ _id: 1, responseId: 1, pin: 1, district: 1, estimatedDistrict: 1, scenarioDistrict: 1 })
    .toArray();

  const ops = docs.map((d) => {
    const a = assignPinForRecord({
      responseId: String(d.responseId ?? ""),
      pin: d.pin,
      recordedDistrict: String(d.district ?? ""),
      estimatedDistrict: String(d.estimatedDistrict ?? ""),
      scenarioDistrict: String(d.scenarioDistrict ?? ""),
    });
    return {
      updateOne: {
        filter: { _id: d._id },
        update: {
          $set: {
            assumedPin: a.assumedPin,
            pinBasis: a.basis,
            pinGeographyBasis: a.basisLabel,
            pinMappingSource: a.source,
            pinAssignmentMethod: a.method,
            "row.Assumed PIN Code": a.assumedPin,
            "row.PIN Geography Basis": a.basisLabel,
            "row.PIN Mapping Source": a.source,
            "row.PIN Assignment Method": a.method,
          },
        },
      },
    };
  });
  for (let i = 0; i < ops.length; i += 1000) {
    await c.responses.bulkWrite(ops.slice(i, i + 1000), { ordered: false });
  }
  const sc = await scenarioCol();
  if (sc) {
    await sc.updateOne(
      { _id: `${caseStudyId}:${pollType}` },
      { $set: { caseStudyId, pollType, importId, appliedAt: new Date().toISOString(), summary: preview.summary } },
      { upsert: true },
    );
  }
  return preview;
}

export async function getPinScenario(caseStudyId: string, pollType: PollType) {
  const sc = await scenarioCol();
  if (!sc) return null;
  return sc.findOne({ _id: `${caseStudyId}:${pollType}` });
}

export async function pinAggregates(caseStudyId: string, pollType: PollType, scenario = false): Promise<PinAggregates> {
  const c = await cols();
  const empty: PinAggregates = { pins: [], total: 0, valid: 0, withPin: 0, withoutPin: 0, invalidPinResponses: 0 };
  if (!c) return empty;
  const importId = await getActiveImportId(caseStudyId, pollType);
  if (!importId) return empty;

  const groupDistrict = scenario ? { $ifNull: ["$scenarioDistrict", "$estimatedDistrict"] } : "$district";
  const match: Record<string, unknown> = { caseStudyId, pollType, importId };
  if (!scenario) match.recorded = true;

  const rows = (await c.responses.aggregate([
    { $match: match },
    { $group: { _id: { pin: "$pinNormalized", status: "$status", party: "$party", district: groupDistrict }, n: { $sum: 1 } } },
  ]).toArray()) as PinGroupRow[];
  return assemblePinAggregates(rows);
}
