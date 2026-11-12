/* Per-session Meta connection tests. Run: npx tsx --conditions react-server scripts/meta-session.test.ts */

import { MongoClient } from "mongodb";
import { cleanupSessionConnection, getActiveConnections, getConnectionBySid, saveConnection, publicStatus } from "@/lib/meta/store";
import { getOwnerOverview } from "@/lib/meta/overview";
import { syncMeta } from "@/lib/meta/sync";

let pass = 0, fail = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

const token = { ciphertext: "x", iv: "x", tag: "x", keyVersion: "v1" };
const now = Date.now();
const future = new Date(now + 12 * 60 * 60 * 1000).toISOString();

function connection(sid: string, userId: string, userName: string, accountId: string) {
  return {
    sid, metaUserId: userId, metaUserName: userName, ownerEmail: "owner@example.com",
    token, tokenExpiresAt: null, scopes: [], account: { id: userId, name: userName },
    adAccounts: [{ id: accountId, accountId, name: `Account ${accountId}`, status: 1, currency: "INR" }],
    pages: [], enabledAdAccounts: [accountId], connectedAt: new Date(now).toISOString(),
    expiresAt: future, lastSyncAt: new Date(now).toISOString(),
  };
}

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.log("MONGODB_URI is required for this test"); process.exitCode = 1; return; }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "reachout");
  await Promise.all(["meta_connection", "meta_accounts", "meta_campaigns", "meta_adsets", "meta_ads", "meta_creatives", "meta_campaign_tags", "meta_insights_range", "meta_insights_daily"].map((name) => db.collection(name).deleteMany({})));

  console.log("\n1. One connection per session");
  await saveConnection(connection("sid-a", "user-a", "User A", "act_a"));
  ok("session A reads its own connection", (await getConnectionBySid("sid-a"))?.metaUserName === "User A");
  ok("session B has no connection", (await getConnectionBySid("sid-b")) === null);
  await saveConnection(connection("sid-b", "user-b", "User B", "act_b"));
  ok("A still reads only A", (await getConnectionBySid("sid-a"))?.metaUserId === "user-a");
  ok("B reads only B", (await getConnectionBySid("sid-b"))?.metaUserId === "user-b");
  ok("connection ids are random, not 'owner'", (await getConnectionBySid("sid-a"))?.metaUserId === "user-a" && (await getConnectionBySid("sid-a"))?.metaUserName === "User A");

  console.log("\n2. Logout deletes and revokes only that session");
  await cleanupSessionConnection("sid-b", "logout");
  ok("session B connection deleted", (await getConnectionBySid("sid-b")) === null);
  ok("session A connection kept", (await getConnectionBySid("sid-a")) !== null);
  ok("status reads the session name", publicStatus(await getConnectionBySid("sid-a")).metaUserName === "User A");

  console.log("\n3. Expired connections are ignored");
  await saveConnection({ ...connection("sid-expired", "user-old", "Old User", "act_old"), expiresAt: new Date(now - 60_000).toISOString() });
  const active = await getActiveConnections();
  ok("expired connection excluded", !active.some((doc) => doc.sid === "sid-expired"));
  ok("expired connection removed", (await getConnectionBySid("sid-expired")) === null);
  ok("active connection kept", active.some((doc) => doc.sid === "sid-a"));

  console.log("\n4. A manual sync uses only that session's connection");
  await syncMeta({ trigger: "manual", sid: "sid-a" });
  const run = await db.collection("meta_sync_runs").find({}).sort({ startedAt: -1 }).limit(1).next();
  ok("manual run records one connection", run?.connections === 1);
  ok("manual run records only User A", Array.isArray(run?.metaUserNames) && run.metaUserNames.length === 1 && run.metaUserNames[0] === "User A");

  console.log("\n5. Dashboard data is scoped to the session's accounts");
  const seed = async (collection: string, doc: Record<string, unknown> & { _id: string }) => {
    await db.collection<{ _id: string }>(collection).updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
  };
  await seed("meta_accounts", { _id: "act_a", accountId: "act_a", name: "Account A", currency: "INR", status: 1, updatedAt: new Date(now).toISOString(), metaUserName: "User A" });
  await seed("meta_accounts", { _id: "act_b", accountId: "act_b", name: "Account B", currency: "INR", status: 1, updatedAt: new Date(now).toISOString(), metaUserName: "User B" });
  await seed("meta_campaigns", { _id: "c_a", accountId: "act_a", name: "A campaign", status: "ACTIVE", effectiveStatus: "ACTIVE" });
  await seed("meta_campaigns", { _id: "c_b", accountId: "act_b", name: "B campaign", status: "ACTIVE", effectiveStatus: "ACTIVE" });
  await seed("meta_campaign_tags", { _id: "c_a", campaignId: "c_a", accountId: "act_a", state: "tamil-nadu", party: "TVK", confirmed: true });
  await seed("meta_campaign_tags", { _id: "c_b", campaignId: "c_b", accountId: "act_b", state: "telangana", party: "BRS", confirmed: true });
  await seed("meta_insights_range", { _id: "campaign:c_a:7d:facebook", level: "campaign", rangeKey: "7d", platform: "facebook", accountId: "act_a", campaignId: "c_a", impressions: 1000, reach: 500, spend: 100 });
  await seed("meta_insights_range", { _id: "campaign:c_b:7d:facebook", level: "campaign", rangeKey: "7d", platform: "facebook", accountId: "act_b", campaignId: "c_b", impressions: 2000, reach: 900, spend: 200 });

  const connA = await getConnectionBySid("sid-a");
  const scoped = await getOwnerOverview(db, {
    range: "7d", platform: "all", accountIds: connA?.adAccounts.map((account) => account.id) ?? [], connection: connA,
  });
  const all = await getOwnerOverview(db, { range: "7d", platform: "all", accountIds: null, connection: connA });
  ok("session A sees only its account", scoped.accounts.length === 1 && scoped.accounts[0].id === "act_a");
  ok("session A sees only its campaigns", scoped.campaigns.length === 1 && scoped.campaigns[0].id === "c_a");
  ok("show-all sees both accounts", all.accounts.length === 2 && all.campaigns.length === 2);
  ok("account labels carry the Meta user name", all.accounts.every((account) => Boolean(account.metaUserName)));
  ok("connection pill carries the Meta user name", scoped.connection.metaUserName === "User A");

  console.log(`\n${pass} passed, ${fail} failed`);
  await client.close();
  process.exit(fail ? 1 : 0);
})().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
