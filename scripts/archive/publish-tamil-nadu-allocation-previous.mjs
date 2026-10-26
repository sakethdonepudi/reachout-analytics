// Publish the build-verified Tamil Nadu aggregate allocation after a Vercel
// production build. The admin allocation endpoint performs the same versioned
// write when an operator republishes manually. Runs only when a real Mongo URI
// is available; the bundled static snapshot remains the fallback.
import fs from "node:fs";
import { MongoClient } from "mongodb";

if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
  console.log("Tamil Nadu allocation publish skipped: non-production deployment.");
  process.exit(0);
}
const uri = process.env.MONGODB_URI;
if (!uri || !/^mongodb(\+srv)?:\/\//.test(uri)) {
  console.log("Tamil Nadu allocation publish skipped: MONGODB_URI not available.");
  process.exit(0);
}
const bundle = JSON.parse(fs.readFileSync("lib/data/tamil-nadu/aggregates.json", "utf8"));
const r = bundle.allocation.reconcile;
if (!r.partyTotalsUnchanged || !r.acDistrictEqual || !r.districtStateEqual || !r.noDoubleCount || r.combinedAssembly !== 31316) {
  console.error("Tamil Nadu allocation publish blocked: reconciliation failed.");
  process.exit(1);
}
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 12000, maxPoolSize: 2 });
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "reachout");
  await db.collection("tamil_nadu_allocations").replaceOne(
    { _id: "tamil-nadu:exit" },
    {
      _id: "tamil-nadu:exit",
      caseStudyId: "tamil-nadu",
      pollType: "exit",
      publishedAt: new Date().toISOString(),
      allocationVersion: bundle.allocation.version,
      sourceImportId: bundle.allocation.sourceImportId,
      sourceHash: bundle.sourceHash,
      bundle,
    },
    { upsert: true },
  );
  console.log(JSON.stringify({ published: true, allocationVersion: bundle.allocation.version, sourceImportId: bundle.allocation.sourceImportId, combined: r.combinedAssembly }));
} catch (error) {
  console.error("Tamil Nadu allocation publish failed:", error instanceof Error ? error.message : String(error));
  // Do not fail the deployment: the static build snapshot is still valid.
  process.exit(0);
} finally {
  await client.close().catch(() => {});
}
