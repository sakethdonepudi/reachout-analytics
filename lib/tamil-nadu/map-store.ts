import "server-only";

import { getMongo } from "@/lib/mongodb";

const COLLECTION = "tn_map_aggregates";

export type TnMapAggregateRow = { n: number; shares: Record<string, number> | null };
export type TnMapSlot = {
  key: string;
  label: string;
  kind: "opinion-verification" | "tracking" | "district-swing";
  period?: string;
  n: number;
  districts: Record<string, TnMapAggregateRow>;
  acs: Record<string, TnMapAggregateRow>;
};
export type TnMapVerification = {
  slot: string;
  label: string;
  htmlN: number;
  rawN: number;
  maxShareDiff: number;
  passed: boolean;
};
export type TnMapDoc = {
  _id?: unknown;
  state: "tamil-nadu";
  version: number;
  uploadedAt: string;
  active: boolean;
  fileName?: string;
  slots: Record<string, TnMapSlot>;
  verification?: TnMapVerification[];
};

async function db() {
  const promise = getMongo();
  if (!promise) return null;
  return (await promise).db(process.env.MONGODB_DB || "reachout");
}

export async function getActiveTnMap(): Promise<TnMapDoc | null> {
  const database = await db();
  if (!database) return null;
  try {
    return await database.collection<TnMapDoc>(COLLECTION).findOne({ state: "tamil-nadu", active: true });
  } catch {
    return null;
  }
}

export async function listTnMapVersions(limit = 10) {
  const database = await db();
  if (!database) return [];
  return database.collection<TnMapDoc>(COLLECTION).find({ state: "tamil-nadu" }, { projection: { slots: 0 } }).sort({ version: -1 }).limit(limit).toArray();
}

export async function publishTnMap(fileName: string, slots: Record<string, TnMapSlot>, verification: TnMapVerification[]): Promise<number> {
  const database = await db();
  if (!database) throw new Error("Database not configured");
  const collection = database.collection<TnMapDoc>(COLLECTION);
  const latest = await collection.find({ state: "tamil-nadu" }).sort({ version: -1 }).limit(1).next();
  const version = (latest?.version ?? 0) + 1;
  await collection.updateMany({ state: "tamil-nadu", active: true }, { $set: { active: false } });
  await collection.insertOne({
    state: "tamil-nadu",
    version,
    uploadedAt: new Date().toISOString(),
    active: true,
    fileName,
    slots,
    verification,
  });
  return version;
}

export async function rollbackTnMap(version: number): Promise<boolean> {
  const database = await db();
  if (!database) throw new Error("Database not configured");
  const collection = database.collection<TnMapDoc>(COLLECTION);
  const target = await collection.findOne({ state: "tamil-nadu", version });
  if (!target) throw new Error("That map aggregate version does not exist.");
  await collection.updateMany({ state: "tamil-nadu" }, { $set: { active: false } });
  await collection.updateOne({ state: "tamil-nadu", version }, { $set: { active: true } });
  return true;
}
