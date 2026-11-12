import "server-only";

import { randomUUID } from "node:crypto";
import { getMongo } from "@/lib/mongodb";
import type { AdsParse } from "@/lib/ads-desk/parse";

export type AdsVersion = {
  _id: string; uploadedBy: string; uploadedAt: string; fileName: string; sha256: string;
  takenAt: string; asOf: string; regionKeys: string[]; totals: Record<string, AdsParse["regions"][number]["totals"]>;
  status: "draft" | "active" | "archived"; data: AdsParse;
};

async function db() {
  const promise = getMongo();
  if (!promise) return null;
  return (await promise).db(process.env.MONGODB_DB || "reachout");
}

export async function getActiveVersion(): Promise<AdsVersion | null> {
  const database = await db();
  if (!database) return null;
  return database.collection<AdsVersion>("ads_versions").findOne({ status: "active" }, { sort: { uploadedAt: -1 } });
}

export async function listVersions(limit = 20): Promise<Omit<AdsVersion, "data">[]> {
  const database = await db();
  if (!database) return [];
  return database.collection<AdsVersion>("ads_versions").find({}, { projection: { data: 0 } }).sort({ uploadedAt: -1 }).limit(limit).toArray();
}

export async function saveDraft(parsed: AdsParse, fileName: string, uploadedBy: string): Promise<string> {
  const database = await db();
  if (!database) throw new Error("Database not configured");
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
  return versionId;
}

export async function publishVersion(versionId: string): Promise<void> {
  const database = await db();
  if (!database) throw new Error("Database not configured");
  const version = await database.collection<AdsVersion>("ads_versions").findOne({ _id: versionId });
  if (!version) throw new Error("Version not found.");
  await database.collection<AdsVersion>("ads_versions").updateMany({ status: "active" }, { $set: { status: "archived" } });
  await database.collection<AdsVersion>("ads_versions").updateOne({ _id: versionId }, { $set: { status: "active" } });
}
