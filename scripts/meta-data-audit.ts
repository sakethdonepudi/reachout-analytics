/* Read-only Meta data audit. Never deletes. Run with a read-only MONGODB_URI. */

import { MongoClient } from "mongodb";

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.log("MONGODB_URI is required"); process.exitCode = 1; return; }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "reachout");
  const collections = ["meta_accounts", "meta_campaigns", "meta_adsets", "meta_ads", "meta_insights_daily", "meta_insights_range"];
  for (const name of collections) {
    const rows = await db.collection(name).aggregate([
      { $group: { _id: { $ifNull: ["$metaUserName", "unknown"] }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray();
    console.log(name, JSON.stringify(rows));
  }
  const connections = await db.collection("meta_connection").find({}, { projection: { token: 0 } }).toArray();
  console.log("meta_connection", JSON.stringify(connections));
  await client.close();
  process.exit(0);
})().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
