import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { read, utils } from "xlsx";
import { getMongo } from "@/lib/mongodb";
import { HISTORY } from "./history";
import { previewOct26Workbook } from "./oct26-import";

/* =====================================================================
   Telangana six-workbook pack import (tg-2014-2028-v1).

   The pack is validated file-by-file: SHA-256 against the supplied
   manifest, 119 ACs and supplied vote totals for each historical year,
   the 2028 schema/cutoff counts, the comparison workbook's row counts and
   numeric 2028 leaders, and the exact Entry ID/AC device join. Publishing
   activates one record atomically; the bundled validated snapshot is what
   the public page serves. No workbook formula text is evaluated.
   ===================================================================== */

const DB = process.env.MONGODB_DB || "reachout";
const IMPORTS = "tg_pack_imports";
const STATE = "tg_pack_state";
const STATE_ID = "telangana:pack:tg-2014-2028-v1";

export const PACK_VERSION = "tg-2014-2028-v1";

export type PackFileKey = "y2014" | "y2018" | "y2023" | "y2028" | "comparison" | "device";

export type PackFileSpec = {
  key: PackFileKey; name: string; sha256: string; description: string;
  expected?: { acs?: number; total?: number; rows?: number; cutoffRows?: number };
};

export const PACK_FILES: PackFileSpec[] = [
  { key: "y2014", name: "Telangana_2014_Election_Results.xlsx", sha256: "5910e4c6b8dce606018c9ab8d6b55a43543475bee9a936b0d8e201e08f3d147a", description: "2014 actual winners and votes", expected: { acs: 119, total: 19_448_279 } },
  { key: "y2018", name: "Telangana_2018_Election_Results.xlsx", sha256: "06924ab05cc64ccb03297e0d06f01db78f112d4c13324c38c9327384a899ac98", description: "2018 actual winners and votes", expected: { acs: 119, total: 20_695_458 } },
  { key: "y2023", name: "Telangana_2023_Election_Results.xlsx", sha256: "6b9ede66705969177cdc850d6f8acf60927ee43a96392ce931b93f837ef0d686", description: "2023 actual winners and votes", expected: { acs: 119, total: 23_439_945 } },
  { key: "y2028", name: "Telangana_2028_Source_Workbook.xlsx", sha256: "d250760098e3aeb21f35f3e139a650a97ae014afc8a4aa68aa67955b9ec7c1f8", description: "5,090-row 2028 survey and projection", expected: { rows: 5090, cutoffRows: 4768 } },
  { key: "comparison", name: "Telangana_2014_2028_Comparison_and_Swing.xlsx", sha256: "0c999ee531cac06495a901e5a698d00d4bf33494329fe4877aa2a614866f2f20", description: "Prepared comparison, swing statistics and predictions" },
  { key: "device", name: "Telangana_Device_Brand_Metadata.xlsx", sha256: "68f729e2ca281030c18a5b079cd7d7b1d2f4256ec5f55db12888daedd93b6642", description: "Exact Entry ID/AC device enrichment", expected: { rows: 5090, cutoffRows: 4768 } },
];

export type FileCheck = {
  key: PackFileKey; name: string; present: boolean; sha256: string; expectedSha256: string; hashMatches: boolean;
  checks: string[]; warnings: string[]; error?: string;
};
export type PackPreview = {
  ok: boolean; version: string; files: FileCheck[]; missing: string[]; warnings: string[];
  counts: {
    years: Record<string, { acs: number; total: number; winners: number }>;
    comparison?: { assemblies: number; swings: number; statistics: number; predictions: number };
    devices?: { rows: number; cutoffRows: number; uniqueEntryIds: number; acs: number; brandRows: number; totalEntries: number };
  };
};

const sha = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");
const rowsFrom = (buffer: Buffer, sheet: string, range = 3) => {
  const wb = read(buffer, { type: "buffer" });
  const ws = wb.Sheets[sheet];
  if (!ws) throw new Error(`Missing sheet "${sheet}"`);
  return utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true, range });
};

function checkHistory(buffer: Buffer, year: "2014" | "2018" | "2023", expectedTotal: number) {
  const rows = rowsFrom(buffer, "Assembly results", 3).filter((r) => Number(r["AC No"]) >= 1 && Number(r["AC No"]) <= 119);
  const acs = new Set(rows.map((r) => Number(r["AC No"])));
  const total = rows.reduce((sum, r) => sum + (Number(r["Total votes"]) || 0), 0);
  const winners = rows.filter((r) => String(r["Winner party"] ?? "").trim()).length;
  const checks = [
    `${rows.length} assembly rows`,
    `${acs.size} unique AC numbers`,
    `${total.toLocaleString("en-IN")} votes`,
    `${winners} winners`,
  ];
  const warnings: string[] = [];
  if (rows.length !== 119) warnings.push(`Expected 119 assembly rows, got ${rows.length}`);
  if (acs.size !== 119) warnings.push(`Expected 119 unique ACs, got ${acs.size}`);
  if (total !== expectedTotal) warnings.push(`Expected ${expectedTotal.toLocaleString("en-IN")} votes, got ${total.toLocaleString("en-IN")}`);
  if (winners !== 119) warnings.push(`Expected 119 winners, got ${winners}`);
  return { checks, warnings, acs: acs.size, total, winners };
}

function checkDevice(buffer: Buffer) {
  const md = rowsFrom(buffer, "Matched metadata", 3);
  const ids = new Set(md.map((r) => String(r["Entry ID"] ?? "").trim()).filter(Boolean));
  const cutoff = md.filter((r) => r["In default cutoff"] === true || String(r["In default cutoff"]).toLowerCase() === "true");
  const acs = new Set(cutoff.map((r) => Number(r["AC No"])).filter((n) => Number.isInteger(n) && n >= 1 && n <= 119));
  const brandRows = rowsFrom(buffer, "Assembly brand mix", 3);
  const brandTotal = brandRows.reduce((s, r) => s + (Number(r.Entries) || 0), 0);
  const checks = [
    `${md.length} matched metadata rows`,
    `${ids.size} unique Entry IDs`,
    `${cutoff.length} rows inside the October cutoff`,
    `${acs.size} ACs represented`,
    `${brandRows.length} assembly-brand rows · ${brandTotal.toLocaleString("en-IN")} entries`,
  ];
  const warnings: string[] = [];
  if (md.length !== 5090) warnings.push(`Expected 5,090 matched rows, got ${md.length}`);
  if (ids.size !== 5090) warnings.push(`Expected 5,090 unique Entry IDs, got ${ids.size}`);
  if (cutoff.length !== 4768) warnings.push(`Expected 4,768 cutoff rows, got ${cutoff.length}`);
  if (acs.size !== 119) warnings.push(`Expected 119 ACs in the cutoff, got ${acs.size}`);
  if (brandTotal !== 4768) warnings.push(`Assembly brand mix totals ${brandTotal}, expected 4,768`);
  return { checks, warnings, rows: md.length, cutoffRows: cutoff.length, uniqueEntryIds: ids.size, acs: acs.size, brandRows: brandRows.length, totalEntries: brandTotal };
}

function checkComparison(buffer: Buffer) {
  const assemblies = rowsFrom(buffer, "Assembly history", 3);
  const swings = rowsFrom(buffer, "Assembly swing", 3);
  const stats = rowsFrom(buffer, "Swing statistics", 3);
  const predictions = rowsFrom(buffer, "2028 predictions", 3);
  const leaders: Record<string, number> = {};
  for (const r of predictions) {
    const leader = String(r["Predicted leader"] ?? "").trim() || "Tie";
    leaders[leader] = (leaders[leader] ?? 0) + 1;
  }
  const checks = [
    `${assemblies.length} assembly-history rows`,
    `${swings.length} assembly-swing rows`,
    `${stats.length} swing-statistic rows`,
    `${predictions.length} prediction rows`,
    `numeric leads ${Object.entries(leaders).map(([p, n]) => `${p} ${n}`).join(" · ")}`,
  ];
  const warnings: string[] = [];
  if (assemblies.length !== 1904) warnings.push(`Expected 1,904 assembly-history rows, got ${assemblies.length}`);
  if (swings.length !== 2380) warnings.push(`Expected 2,380 assembly-swing rows, got ${swings.length}`);
  if (stats.length !== 20) warnings.push(`Expected 20 swing-statistic rows, got ${stats.length}`);
  if (predictions.length !== 119) warnings.push(`Expected 119 prediction rows, got ${predictions.length}`);
  const expectLeaders: Record<string, number> = { BRS: 70, Congress: 27, BJP: 13, Others: 8, Tie: 1 };
  const ordered = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  if (JSON.stringify(ordered(leaders)) !== JSON.stringify(ordered(expectLeaders))) warnings.push(`2028 numeric leaders ${JSON.stringify(leaders)} differ from ${JSON.stringify(expectLeaders)}`);
  return { checks, warnings, assemblies: assemblies.length, swings: swings.length, statistics: stats.length, predictions: predictions.length };
}

export function previewPack(files: { name: string; buffer: Buffer }[]): PackPreview {
  const byName = new Map(files.map((f) => [path.basename(f.name).toLowerCase(), f]));
  const results: FileCheck[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];
  const counts: PackPreview["counts"] = { years: {} };

  for (const spec of PACK_FILES) {
    const found = byName.get(spec.name.toLowerCase());
    if (!found) {
      missing.push(spec.name);
      results.push({ key: spec.key, name: spec.name, present: false, sha256: "", expectedSha256: spec.sha256, hashMatches: false, checks: [], warnings: [] });
      continue;
    }
    const digest = sha(found.buffer);
    const file: FileCheck = {
      key: spec.key, name: spec.name, present: true, sha256: digest, expectedSha256: spec.sha256,
      hashMatches: digest === spec.sha256, checks: [], warnings: [],
    };
    if (!file.hashMatches) file.warnings.push("SHA-256 does not match the supplied workbook manifest.");
    try {
      if (spec.key === "y2014" || spec.key === "y2018" || spec.key === "y2023") {
        const year = spec.key.slice(1) as "2014" | "2018" | "2023";
        const r = checkHistory(found.buffer, year, spec.expected?.total ?? 0);
        file.checks = r.checks; file.warnings.push(...r.warnings);
        counts.years[year] = { acs: r.acs, total: r.total, winners: r.winners };
      } else if (spec.key === "y2028") {
        const p = previewOct26Workbook(found.buffer);
        file.checks = [
          `${p.rows} source rows`,
          `${p.cutoffRows} rows after cutoff`,
          `${p.answered2028} answered 2028`,
          `${p.answeredRecall2023} answered 2023 recall`,
        ];
        file.warnings.push(...p.warnings);
      } else if (spec.key === "device") {
        const r = checkDevice(found.buffer);
        file.checks = r.checks; file.warnings.push(...r.warnings);
        counts.devices = { rows: r.rows, cutoffRows: r.cutoffRows, uniqueEntryIds: r.uniqueEntryIds, acs: r.acs, brandRows: r.brandRows, totalEntries: r.totalEntries };
      } else {
        const r = checkComparison(found.buffer);
        file.checks = r.checks; file.warnings.push(...r.warnings);
        counts.comparison = { assemblies: r.assemblies, swings: r.swings, statistics: r.statistics, predictions: r.predictions };
      }
    } catch (e) {
      file.error = e instanceof Error ? e.message : "Workbook could not be read";
    }
    if (file.error) file.warnings.push(file.error);
    warnings.push(...file.warnings.map((w) => `${spec.name}: ${w}`));
    results.push(file);
  }

  const unknown = files.map((f) => path.basename(f.name)).filter((n) => !PACK_FILES.some((s) => s.name.toLowerCase() === n.toLowerCase()));
  if (unknown.length) warnings.push(`Unrecognised file(s): ${unknown.join(", ")}`);
  const ok = missing.length === 0 && results.every((f) => f.present && f.hashMatches && !f.error && f.warnings.length === 0);
  return { ok, version: PACK_VERSION, files: results, missing, warnings, counts };
}

export type PackImport = {
  importId: string; version: string; at: string; uploader: string; outcome: "success" | "failed";
  files: { key: string; name: string; sha256: string }[];
  counts: PackPreview["counts"]; warnings: string[]; error?: string;
};

async function collections() {
  try {
    const promise = getMongo();
    if (!promise) return null;
    const db = (await promise).db(DB);
    return {
      imports: db.collection<PackImport>(IMPORTS),
      state: db.collection<{ _id: string; importId: string; at: string }>(STATE),
    };
  } catch {
    return null;
  }
}

export async function isPackStoreReady(): Promise<boolean> {
  const c = await collections();
  if (!c) return false;
  try { await c.imports.estimatedDocumentCount(); return true; } catch { return false; }
}

export async function activePack(): Promise<PackImport | null> {
  const c = await collections();
  if (!c) return null;
  const state = await c.state.findOne({ _id: STATE_ID });
  return state ? c.imports.findOne({ importId: state.importId }) : null;
}

export async function packHistory(limit = 20): Promise<PackImport[]> {
  const c = await collections();
  if (!c) return [];
  return c.imports.find({}).sort({ at: -1 }).limit(limit).toArray();
}

export async function publishPack(opts: { files: { name: string; buffer: Buffer }[]; uploader: string }): Promise<PackImport> {
  const at = new Date().toISOString();
  const importId = randomUUID();
  const preview = previewPack(opts.files);
  const base: PackImport = {
    importId, version: PACK_VERSION, at, uploader: opts.uploader,
    outcome: "failed", files: preview.files.filter((f) => f.present).map((f) => ({ key: f.key, name: f.name, sha256: f.sha256 })),
    counts: preview.counts, warnings: preview.warnings,
  };
  const c = await collections();
  if (!c) return { ...base, error: "Database not configured (MONGODB_URI missing)" };
  if (!preview.ok) {
    const error = preview.missing.length ? `Missing workbook(s): ${preview.missing.join(", ")}` : preview.warnings[0] ?? "Pack preview failed";
    await c.imports.insertOne({ ...base, error });
    return { ...base, error };
  }
  await c.imports.insertOne({ ...base, outcome: "success" });
  try {
    await c.state.updateOne({ _id: STATE_ID }, { $set: { importId, at } }, { upsert: true });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Activation failed";
    await c.imports.updateOne({ importId }, { $set: { outcome: "failed", error } });
    return { ...base, outcome: "failed", error };
  }
  return { ...base, outcome: "success" };
}

export async function revertPack(actor: string): Promise<{ ok: boolean; error?: string }> {
  const c = await collections();
  if (!c) return { ok: false, error: "Database not configured" };
  await c.state.deleteOne({ _id: STATE_ID });
  await c.imports.insertOne({
    importId: randomUUID(), version: PACK_VERSION, at: new Date().toISOString(), uploader: actor,
    outcome: "success", files: [], counts: { years: {} }, warnings: [],
    error: "Reverted to the bundled validated pack snapshot",
  });
  return { ok: true };
}

/** Aggregates/provenance export extension; no Entry IDs or raw rows. */
export function packProvenance() {
  return {
    version: PACK_VERSION,
    files: PACK_FILES.map((f) => ({ key: f.key, name: f.name, sha256: f.sha256, description: f.description })),
    years: Object.fromEntries(Object.entries(HISTORY.years).map(([y, v]) => [y, { total: v.total, shares: v.shares, seats: v.seats }])),
    sourceAudit: HISTORY.sourceAudit,
    swingStatistics: { intervals: 5, parties: 4, assemblies: 119 },
    devices: { total: HISTORY.devices.total, brands: HISTORY.devices.brands.length, assemblies: Object.keys(HISTORY.devices.byAc).length, note: HISTORY.devices.note },
    exportedAt: new Date().toISOString(),
  };
}
