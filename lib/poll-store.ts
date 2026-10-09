import { randomUUID } from "node:crypto";
import { getMongo } from "@/lib/mongodb";
import { partyStatus, isRecordedDistrict, estimatedDistrictOf, recordedDistrictOf, scenarioDistrictOf, type PollType, type Row } from "@/lib/poll-data";

/* =====================================================================
   Persistent poll datasets in MongoDB.

   - poll_responses : one document per response row (+ computed fields)
   - poll_imports   : import history / dataset versions
   - poll_state     : the active import per poll type (atomic replace pointer)

   Replace inserts a full new batch then flips the active pointer in a single
   document update, so a failed import never leaves a partially-replaced set.
   ===================================================================== */

export type ImportMeta = {
  importId: string;
  pollType: PollType;
  filename: string;
  uploader: string;
  at: string;
  outcome: "success" | "failed";
  mode: "append" | "replace";
  inserted: number;
  skipped: number;
  counts: { total: number; valid: number; blank: number; invalid: number; recorded: number; estimated: number };
  headers: string[];
  error?: string;
};

const DB = process.env.MONGODB_DB || "reachout";

async function cols() {
  const p = getMongo();
  if (!p) return null;
  const client = await p;
  const db = client.db(DB);
  return {
    responses: db.collection("poll_responses"),
    imports: db.collection<ImportMeta>("poll_imports"),
    state: db.collection<{ _id: PollType; activeImportId: string }>("poll_state"),
  };
}

export async function isConfigured() {
  return getMongo() !== null;
}

export async function getActiveImportId(pollType: PollType): Promise<string | null> {
  const c = await cols();
  if (!c) return null;
  const s = await c.state.findOne({ _id: pollType });
  return s?.activeImportId ?? null;
}

async function recordImport(meta: ImportMeta) {
  const c = await cols();
  if (c) await c.imports.insertOne(meta);
}

function toDoc(row: Row, pollType: PollType, importId: string) {
  const status = partyStatus(row["Party"]);
  return {
    pollType,
    importId,
    responseId: String(row["Response ID"] ?? ""),
    survey: String(row["Survey"] ?? ""),
    state: String(row["State"] ?? ""),
    district: recordedDistrictOf(row),
    ac: String(row["Assembly Constituency"] ?? ""),
    pin: String(row["PIN Code"] ?? ""),
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

export function countRows(rows: Row[]) {
  let valid = 0, blank = 0, invalid = 0, recorded = 0, estimated = 0;
  for (const r of rows) {
    const s = partyStatus(r["Party"]);
    if (s === "valid") valid++; else if (s === "blank") blank++; else invalid++;
    if (s === "valid") { if (isRecordedDistrict(r)) recorded++; else if (estimatedDistrictOf(r)) estimated++; }
  }
  return { total: rows.length, valid, blank, invalid, recorded, estimated };
}

/** Import rows. `append` rejects duplicate Response IDs; `replace` swaps atomically. */
export async function importDataset(opts: {
  pollType: PollType; rows: Row[]; filename: string; uploader: string; mode: "append" | "replace"; headers: string[];
}): Promise<ImportMeta> {
  const { pollType, rows, filename, uploader, mode, headers } = opts;
  const counts = countRows(rows);
  const at = new Date().toISOString();
  const c = await cols();
  if (!c) {
    const meta: ImportMeta = { importId: randomUUID(), pollType, filename, uploader, at, outcome: "failed", mode, inserted: 0, skipped: 0, counts, headers, error: "Database not configured (MONGODB_URI missing)" };
    return meta;
  }

  const existingImportId = mode === "append" ? await getActiveImportId(pollType) : null;
  let skipIds = new Set<string>();
  if (existingImportId) {
    const existing = await c.responses.find({ pollType, importId: existingImportId }).project({ responseId: 1 }).toArray();
    skipIds = new Set(existing.map((d) => d.responseId));
  }

  const importId = existingImportId ?? randomUUID();
  const docs = rows
    .filter((r, i) => {
      const id = String(r["Response ID"] ?? "").trim() || `__row${i}`;
      if (skipIds.has(id)) return false;
      skipIds.add(id);
      return true;
    })
    .map((r) => toDoc(r, pollType, importId));
  const skipped = rows.length - docs.length;

  try {
    if (docs.length) {
      for (let i = 0; i < docs.length; i += 2000) {
        await c.responses.insertMany(docs.slice(i, i + 2000), { ordered: true });
      }
    }
    // atomic activation: only after the insert fully succeeded
    await c.state.updateOne({ _id: pollType }, { $set: { activeImportId: importId } }, { upsert: true });
    const meta: ImportMeta = { importId, pollType, filename, uploader, at, outcome: "success", mode, inserted: docs.length, skipped, counts, headers };
    await recordImport(meta);
    return meta;
  } catch (e) {
    // insert failed → active pointer untouched, existing data intact
    await c.responses.deleteMany({ pollType, importId, _new: true });
    const meta: ImportMeta = { importId, pollType, filename, uploader, at, outcome: "failed", mode, inserted: 0, skipped, counts, headers, error: e instanceof Error ? e.message : "insert failed" };
    await recordImport(meta);
    return meta;
  }
}

export async function summary(pollType: PollType) {
  const c = await cols();
  if (!c) return null;
  const importId = await getActiveImportId(pollType);
  if (!importId) return { pollType, importId: null, counts: { total: 0, valid: 0, blank: 0, invalid: 0, recorded: 0, estimated: 0 }, asOf: null };
  const agg = await c.responses.aggregate([
    { $match: { pollType, importId } },
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
  const counts = agg[0] ?? { total: 0, valid: 0, blank: 0, invalid: 0, recorded: 0, estimated: 0 };
  delete (counts as { _id?: unknown })._id;
  const latest = await c.imports.find({ pollType, importId }).sort({ at: -1 }).limit(1).toArray();
  return { pollType, importId, counts, asOf: latest[0]?.at ?? null };
}

export async function partyShares(pollType: PollType, scenario = false) {
  const c = await cols();
  if (!c) return { denominator: 0, shares: [] as { party: string; count: number; pct: number }[] };
  const importId = await getActiveImportId(pollType);
  if (!importId) return { denominator: 0, shares: [] };
  const rows = await c.responses.aggregate([
    { $match: { pollType, importId, status: "valid", ...(scenario ? { recorded: false } : {}) } },
    { $group: { _id: "$party", count: { $sum: 1 } } },
  ]).toArray();
  const denominator = rows.reduce((a, r) => a + (r.count as number), 0);
  const shares = rows
    .map((r) => ({ party: r._id as string, count: r.count as number, pct: denominator ? +((r.count / denominator) * 100).toFixed(2) : 0 }))
    .sort((a, b) => b.count - a.count);
  return { denominator, shares };
}

export async function listRecords(pollType: PollType, filters: Record<string, string>, limit = 100, skip = 0) {
  const c = await cols();
  if (!c) return { records: [] as Row[], total: 0 };
  const importId = await getActiveImportId(pollType);
  if (!importId) return { records: [], total: 0 };
  const q: Record<string, unknown> = { pollType, importId };
  if (filters.party) q.party = filters.party;
  if (filters.status) q.status = filters.status;
  if (filters.geographyBasis) q.geographyBasis = filters.geographyBasis;
  if (filters.district) q.$or = [{ district: filters.district }, { estimatedDistrict: filters.district }, { scenarioDistrict: filters.district }];
  if (filters.q) q.responseId = { $regex: filters.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const total = await c.responses.countDocuments(q);
  const docs = await c.responses.find(q).skip(skip).limit(limit).toArray();
  return { records: docs.map((d) => d.row as Row), total };
}

export async function history(limit = 25) {
  const c = await cols();
  if (!c) return [];
  return c.imports.find({}).sort({ at: -1 }).limit(limit).project({ _id: 0 }).toArray();
}
