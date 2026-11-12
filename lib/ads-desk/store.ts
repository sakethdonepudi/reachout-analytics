import "server-only";

import { randomUUID } from "node:crypto";
import { unstable_cache, revalidateTag } from "next/cache";
import { getMongo } from "@/lib/mongodb";
import type { AdsParse } from "@/lib/ads-desk/parse";
import { buildRegionSummaries, type AdsRegionSummary } from "@/lib/ads-desk/summary";

export type AdsVersion = {
  _id: string; uploadedBy: string; uploadedAt: string; fileName: string; sha256: string;
  takenAt: string; asOf: string; regionKeys: string[]; totals: Record<string, AdsParse["regions"][number]["totals"]>;
  status: "draft" | "active" | "archived"; data: AdsParse;
};

type Database = Awaited<ReturnType<typeof db>>;

async function db() {
  const promise = getMongo();
  if (!promise) return null;
  return (await promise).db(process.env.MONGODB_DB || "reachout");
}

async function ensureIndexes(database: NonNullable<Database>): Promise<void> {
  await Promise.all([
    database.collection("ads_versions").createIndex({ status: 1, uploadedAt: -1 }).catch(() => {}),
    database.collection("ads_regions").createIndex({ versionId: 1, key: 1 }).catch(() => {}),
    database.collection("ads_accounts").createIndex({ versionId: 1, regionKey: 1, id: 1 }).catch(() => {}),
    database.collection("ads_campaigns").createIndex({ versionId: 1, regionKey: 1, accountId: 1 }).catch(() => {}),
    database.collection("ads_pages").createIndex({ versionId: 1, pageId: 1 }).catch(() => {}),
    database.collection("ads_region_summaries").createIndex({ versionId: 1, regionKey: 1 }, { unique: true }).catch(() => {}),
  ]);
}

async function readActiveVersionId(): Promise<string | null> {
  const database = await db();
  if (!database) return null;
  await ensureIndexes(database);
  const row = await database.collection<AdsVersion>("ads_versions").findOne({ status: "active" }, { sort: { uploadedAt: -1 }, projection: { _id: 1 } });
  return row?._id ?? null;
}

const cachedActiveVersionId = unstable_cache(readActiveVersionId, ["ads-active-version-id"], { tags: ["ads"] });

/** Active version id only. Never reads ads_versions.data. */
export async function getActiveVersionId(): Promise<string | null> {
  try {
    return await cachedActiveVersionId();
  } catch {
    return readActiveVersionId();
  }
}

async function readRegionSummaries(versionId: string): Promise<AdsRegionSummary[]> {
  const database = await db();
  if (!database) return [];
  await ensureIndexes(database);
  return database.collection<AdsRegionSummary>("ads_region_summaries").find({ versionId }).toArray();
}

const cachedRegionSummaries = unstable_cache(async (versionId: string) => {
  const rows = await readRegionSummaries(versionId);
  return rows.length ? rows : null;
}, ["ads-region-summaries"], { tags: ["ads"] });

/** Per-region summary documents. Empty results are never served from cache. */
export async function getRegionSummaries(versionId: string): Promise<AdsRegionSummary[]> {
  try {
    const rows = await cachedRegionSummaries(versionId);
    if (rows?.length) return rows;
  } catch {
    // fall through to an uncached read
  }
  return readRegionSummaries(versionId);
}

async function buildActiveSummaries(versionId: string): Promise<AdsRegionSummary[]> {
  const database = await db();
  if (!database) return [];
  const active = await database.collection<AdsVersion>("ads_versions").findOne({ _id: versionId });
  if (!active) return [];
  const summaries = buildRegionSummaries(active.data, versionId);
  if (summaries.length) {
    await database.collection("ads_region_summaries").deleteMany({ versionId });
    await database.collection("ads_region_summaries").insertMany(summaries);
  }
  return summaries;
}

export async function getActiveRegionSummaries(): Promise<AdsRegionSummary[]> {
  const versionId = await getActiveVersionId();
  if (!versionId) return [];
  const summaries = await getRegionSummaries(versionId);
  if (summaries.length) return summaries;
  // One-time backfill after a deploy of an active version published before
  // summaries existed. Return the Mongo rows directly; never read the empty cache again.
  const built = await buildActiveSummaries(versionId);
  if (!built.length) console.warn("Ads summaries are missing for the active version.");
  return built;
}

function invalidateAdsCache(): void {
  try {
    revalidateTag("ads");
  } catch {
    // Outside a Next request context (tests or scripts).
  }
}

export async function getActiveVersion(): Promise<AdsVersion | null> {
  const database = await db();
  if (!database) return null;
  await ensureIndexes(database);
  return database.collection<AdsVersion>("ads_versions").findOne({ status: "active" }, { sort: { uploadedAt: -1 } });
}

export async function listVersions(limit = 20): Promise<Omit<AdsVersion, "data">[]> {
  const database = await db();
  if (!database) return [];
  await ensureIndexes(database);
  return database.collection<AdsVersion>("ads_versions").find({}, { projection: { data: 0 } }).sort({ uploadedAt: -1 }).limit(limit).toArray();
}

export async function saveDraft(parsed: AdsParse, fileName: string, uploadedBy: string): Promise<string> {
  const database = await db();
  if (!database) throw new Error("Database not configured");
  await ensureIndexes(database);
  const active = await getActiveVersion();
  if (active?.sha256 === parsed.sha256) throw new Error("This exact file is already the active version.");
  const versionId = randomUUID();
  const totals = Object.fromEntries(parsed.regions.map((region) => [region.key, region.totals]));
  await database.collection<AdsVersion>("ads_versions").insertOne({
    _id: versionId, uploadedBy, uploadedAt: new Date().toISOString(), fileName, sha256: parsed.sha256,
    takenAt: parsed.takenAt, asOf: parsed.asOf, regionKeys: parsed.regionKeys, totals, status: "draft", data: parsed,
  });
  await database.collection("ads_regions").insertMany(parsed.regions.map((region) => ({ versionId, ...region })));
  await database.collection("ads_accounts").insertMany(parsed.regions.flatMap((region) => region.accounts.map((account) => ({ versionId, regionKey: region.key, id: account.id, name: account.name, business: account.business, campaigns: account.campaigns.length }))));
  await database.collection("ads_campaigns").insertMany(parsed.regions.flatMap((region) => region.accounts.flatMap((account) => account.campaigns.map((campaign) => ({ versionId, regionKey: region.key, accountId: account.id, ...campaign })))));
  await database.collection("ads_pages").insertMany(parsed.snap.pages.map((page) => ({ versionId, pageId: page.id, name: page.name })));
  invalidateAdsCache();
  return versionId;
}

export async function publishVersion(versionId: string): Promise<void> {
  const database = await db();
  if (!database) throw new Error("Database not configured");
  await ensureIndexes(database);
  const version = await database.collection<AdsVersion>("ads_versions").findOne({ _id: versionId });
  if (!version) throw new Error("Version not found.");
  await database.collection<AdsVersion>("ads_versions").updateMany({ status: "active" }, { $set: { status: "archived" } });
  await database.collection<AdsVersion>("ads_versions").updateOne({ _id: versionId }, { $set: { status: "active" } });
  const summaries = buildRegionSummaries(version.data, versionId);
  await database.collection("ads_region_summaries").deleteMany({ versionId });
  if (summaries.length) await database.collection("ads_region_summaries").insertMany(summaries);
  invalidateAdsCache();
}

/** One-time backfill for the active version after a deploy. Idempotent. */
export async function backfillActiveSummaries(): Promise<number> {
  const database = await db();
  if (!database) return 0;
  await ensureIndexes(database);
  const active = await database.collection<AdsVersion>("ads_versions").findOne({ status: "active" }, { sort: { uploadedAt: -1 } });
  if (!active) return 0;
  const existing = await database.collection("ads_region_summaries").countDocuments({ versionId: active._id });
  if (existing > 0) return 0;
  const summaries = await buildActiveSummaries(active._id);
  return summaries.length;
}

/** Owner-triggered rebuild. Revalidates the ads cache outside render. */
export async function rebuildActiveSummaries(): Promise<number> {
  const database = await db();
  if (!database) return 0;
  await ensureIndexes(database);
  const active = await database.collection<AdsVersion>("ads_versions").findOne({ status: "active" }, { sort: { uploadedAt: -1 } });
  if (!active) return 0;
  const summaries = await buildActiveSummaries(active._id);
  invalidateAdsCache();
  return summaries.length;
}
