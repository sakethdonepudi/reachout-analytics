import { getMongo } from "@/lib/mongodb";
import { buildRegionSummaries } from "@/lib/ads-desk/summary";
import type { AdsVersion } from "@/lib/ads-desk/store";

(async () => {
  const promise = getMongo();
  if (!promise) throw new Error("Database not configured");
  const database = (await promise).db(process.env.MONGODB_DB || "reachout");
  await Promise.all([
    database.collection("ads_region_summaries").createIndex({ versionId: 1, regionKey: 1 }, { unique: true }).catch(() => {}),
    database.collection("ads_accounts").createIndex({ versionId: 1, regionKey: 1, id: 1 }).catch(() => {}),
    database.collection("ads_campaigns").createIndex({ versionId: 1, regionKey: 1, accountId: 1 }).catch(() => {}),
  ]);
  const active = await database.collection<AdsVersion>("ads_versions").findOne({ status: "active" }, { sort: { uploadedAt: -1 } });
  if (!active) { console.log("No active ads version."); process.exit(0); }
  const summaries = buildRegionSummaries(active.data, active._id);
  await database.collection("ads_region_summaries").deleteMany({ versionId: active._id });
  if (summaries.length) await database.collection("ads_region_summaries").insertMany(summaries);
  console.log(`Backfilled ${summaries.length} summaries for active version ${active._id}.`);
  process.exit(0);
})().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
