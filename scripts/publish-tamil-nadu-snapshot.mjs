// Publish the build-verified Tamil Nadu aggregate snapshot after a Vercel
// production build. The previous geographic-allocation snapshot is retired;
// only this new calibrated-workbook snapshot is written.
import fs from "node:fs";
import { MongoClient } from "mongodb";

if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
  console.log("Tamil Nadu snapshot publish skipped: non-production deployment.");
  process.exit(0);
}
const uri = process.env.MONGODB_URI;
if (!uri || !/^mongodb(\+srv)?:\/\//.test(uri)) {
  console.log("Tamil Nadu snapshot publish skipped: MONGODB_URI not available.");
  process.exit(0);
}
const bundle = JSON.parse(fs.readFileSync("lib/data/tamil-nadu/aggregates.json", "utf8"));
if (bundle.version !== "tn-2026-saket-v3" || bundle.statewide?.survey?.valid !== 31672 || bundle.acs?.length !== 234 || bundle.districts?.length !== 38) {
  console.error("Tamil Nadu snapshot publish blocked: source validation failed.");
  process.exit(1);
}
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 12000, maxPoolSize: 2 });
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "reachout");
  await db.collection("tamil_nadu_snapshots").replaceOne(
    { _id: "tamil-nadu:exit" },
    {
      _id: "tamil-nadu:exit",
      caseStudyId: "tamil-nadu",
      pollType: "exit",
      publishedAt: new Date().toISOString(),
      sourceVersion: bundle.version,
      sourceImportId: bundle.sourceImportId,
      sourceHash: bundle.sourceHash,
      bundle,
    },
    { upsert: true },
  );
  console.log(JSON.stringify({ published: true, version: bundle.version, sourceImportId: bundle.sourceImportId, total: bundle.statewide.survey.valid }));
} catch (error) {
  console.error("Tamil Nadu snapshot publish failed:", error instanceof Error ? error.message : String(error));
  process.exit(0);
} finally {
  await client.close().catch(() => {});
}
