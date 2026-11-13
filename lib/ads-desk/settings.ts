import "server-only";

import { unstable_cache, revalidateTag } from "next/cache";
import { getMongo } from "@/lib/mongodb";

const DB = process.env.MONGODB_DB || "reachout";
const DEFAULT_CLIENT_LINKS = true;

async function readClientLinks(): Promise<boolean> {
  const promise = getMongo();
  if (!promise) return DEFAULT_CLIENT_LINKS;
  try {
    const doc = await (await promise).db(DB).collection<{ _id: string; clientLinks?: boolean; updatedAt?: string }>("ads_settings").findOne({ _id: "client_links" });
    return doc?.clientLinks ?? DEFAULT_CLIENT_LINKS;
  } catch {
    return DEFAULT_CLIENT_LINKS;
  }
}

const cachedClientLinks = unstable_cache(readClientLinks, ["ads-client-links-v1"], { tags: ["ads"] });

export async function getClientLinks(): Promise<boolean> {
  try {
    return await cachedClientLinks();
  } catch {
    return readClientLinks();
  }
}

export async function setClientLinks(enabled: boolean): Promise<void> {
  const promise = getMongo();
  if (!promise) throw new Error("Database not configured");
  await (await promise).db(DB).collection<{ _id: string; clientLinks?: boolean; updatedAt?: string }>("ads_settings").updateOne(
    { _id: "client_links" },
    { $set: { clientLinks: enabled, updatedAt: new Date().toISOString() } },
    { upsert: true },
  );
  try { revalidateTag("ads"); } catch { /* outside a Next request context */ }
}
