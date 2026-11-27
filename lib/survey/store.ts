import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { getMongo } from "@/lib/mongodb";
import type { SurveyData } from "./types";

const COLLECTION = "survey_dashboards";

type SurveyDoc = { state: string; version: number; uploadedAt: string; active: boolean; fileName?: string; uploadedBy?: string; data: SurveyData };
export type SurveyVersionRow = { version: number; fileName: string; uploadedAt: string; uploadedBy?: string; active: boolean };

async function db() {
  const promise = getMongo();
  if (!promise) return null;
  return (await promise).db(process.env.MONGODB_DB || "reachout");
}

export async function getActiveSurvey(state: string): Promise<SurveyDoc | null> {
  const database = await db();
  if (!database) return null;
  try {
    return await database.collection<SurveyDoc>(COLLECTION).findOne({ state, active: true }, { projection: { _id: 0 } });
  } catch {
    return null;
  }
}

export function getSurveyCached(state: string) {
  return unstable_cache(() => getActiveSurvey(state), ["survey-dashboard", state], { tags: [`survey:${state}`] })();
}

export async function listSurveyVersions(state: string, limit = 10): Promise<SurveyVersionRow[]> {
  const database = await db();
  if (!database) return [];
  const rows = await database.collection<SurveyDoc>(COLLECTION).find({ state }, { projection: { data: 0 } }).sort({ version: -1 }).limit(limit).toArray();
  return rows.map((row) => ({ version: row.version, fileName: row.fileName ?? "dashboard.html", uploadedAt: row.uploadedAt, uploadedBy: row.uploadedBy, active: Boolean(row.active) }));
}

export async function publishSurvey(state: string, fileName: string, data: SurveyData, uploadedBy = "Owner") {
  const database = await db();
  if (!database) throw new Error("Database not configured");
  const collection = database.collection<SurveyDoc>(COLLECTION);
  const latest = await collection.find({ state }).sort({ version: -1 }).limit(1).next();
  const version = (latest?.version ?? 0) + 1;
  await collection.updateMany({ state, active: true }, { $set: { active: false } });
  await collection.insertOne({ state, version, fileName, uploadedAt: new Date().toISOString(), uploadedBy, active: true, data });
  try { revalidateTag(`survey:${state}`); } catch { /* seed scripts run outside a request */ }
  return version;
}

export async function rollbackSurvey(state: string, version: number) {
  const database = await db();
  if (!database) throw new Error("Database not configured");
  const collection = database.collection<SurveyDoc>(COLLECTION);
  const target = await collection.findOne({ state, version });
  if (!target) throw new Error("That survey version does not exist.");
  await collection.updateMany({ state }, { $set: { active: false } });
  await collection.updateOne({ state, version }, { $set: { active: true } });
  try { revalidateTag(`survey:${state}`); } catch { /* seed scripts run outside a request */ }
  return true;
}
