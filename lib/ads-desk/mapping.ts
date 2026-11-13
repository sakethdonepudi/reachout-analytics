import "server-only";

import { getMongo } from "@/lib/mongodb";
import { caseBySlug } from "@/lib/cases";
import { getActiveRegionSummaries } from "@/lib/ads-desk/store";
import { buildAdsSocialFromSummary, type AdsSocialView } from "@/lib/ads-desk/client-dto";
import { getClientLinks } from "@/lib/ads-desk/settings";

export const DEFAULT_REGION_MAP: Record<string, string> = {
  tn2026: "tamil-nadu",
  ap2024: "andhra-pradesh-2024",
  tg2025: "telangana",
  bh2025: "bihar",
  gj2027: "gujarat",
  ka2028: "karnataka-2023",
};

type MapDoc = { _id: string; caseSlug: string; updatedAt: string; updatedBy: string };

async function collection() {
  const promise = getMongo();
  if (!promise) return null;
  return (await promise).db(process.env.MONGODB_DB || "reachout").collection<MapDoc>("ads_region_map");
}

export async function getRegionMap(): Promise<Record<string, string>> {
  const col = await collection();
  if (!col) return { ...DEFAULT_REGION_MAP };
  const rows = await col.find({}).toArray();
  const existing = new Set(rows.map((row) => row._id));
  const missing = Object.entries(DEFAULT_REGION_MAP).filter(([key]) => !existing.has(key));
  if (missing.length) await col.insertMany(missing.map(([regionKey, caseSlug]) => ({ _id: regionKey, caseSlug, updatedAt: new Date().toISOString(), updatedBy: "default" }))).catch(() => {});
  return { ...DEFAULT_REGION_MAP, ...Object.fromEntries(rows.map((row) => [row._id, row.caseSlug])) };
}

export async function setRegionMapping(regionKey: string, caseSlug: string | null, updatedBy: string): Promise<{ ok: boolean; error?: string }> {
  const col = await collection();
  if (!col) return { ok: false, error: "Database not configured" };
  if (caseSlug && !caseBySlug(caseSlug)) return { ok: false, error: "Unknown case study" };
  if (caseSlug) await col.updateOne({ _id: regionKey }, { $set: { caseSlug, updatedAt: new Date().toISOString(), updatedBy } }, { upsert: true });
  else await col.deleteOne({ _id: regionKey });
  return { ok: true };
}

export async function socialForCase(slug: string, includeCost: boolean): Promise<AdsSocialView[]> {
  const [summaries, map, clientLinks] = await Promise.all([getActiveRegionSummaries(), getRegionMap(), getClientLinks()]);
  if (!summaries.length) return [];
  const keys = Object.entries(map).filter(([, value]) => value === slug).map(([key]) => key);
  return keys.map((key) => {
    const summary = summaries.find((item) => item.regionKey === key);
    if (!summary) return null;
    const view = buildAdsSocialFromSummary(summary, includeCost, includeCost || clientLinks);
    if (key === "ka2028") return { ...view, label: "Karnataka 2026-28" };
    return view;
  }).filter((view): view is AdsSocialView => Boolean(view));
}

export async function unmappedRegions(): Promise<string[]> {
  const [summaries, map] = await Promise.all([getActiveRegionSummaries(), getRegionMap()]);
  return summaries.map((item) => item.regionKey).filter((key) => !map[key]);
}
