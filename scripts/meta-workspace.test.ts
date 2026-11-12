/* Workspace Meta holder, lifetime, reminders, revoke and no-session sync tests. */

import { MongoClient } from "mongodb";
import { NextRequest } from "next/server";
import { encryptToken } from "@/lib/meta/crypto";
import { createSession, revokeSession } from "@/lib/auth";
import { GET as startConnect } from "@/app/api/meta/owner/connect/start/route";
import { createUser } from "@/lib/users";
import { getMetaHolder, saveWorkspaceConnection, getWorkspaceConnection, setMetaHolderUserId, publicStatus, META_HOLDER_USERNAME } from "@/lib/meta/store";
import { checkWorkspaceHealth, connectionLifetime } from "@/lib/meta/health";
import { syncMeta } from "@/lib/meta/sync";
import { metaAuthUrl, createMetaFlow, META_SCOPES } from "@/lib/meta/oauth";
import { facebookFailureReason } from "@/lib/meta/connect-callback";
import { META_CONNECTION_TTL_MS } from "@/lib/meta/insights";

let pass = 0, fail = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

const DAY = 86_400_000;
function graphStub(debugValid = true) {
  const original = global.fetch;
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/debug_token")) return new Response(JSON.stringify({ data: { is_valid: debugValid, scopes: META_SCOPES } }), { status: 200 });
    if (init?.method === "DELETE") return new Response(JSON.stringify({ success: true }), { status: 200 });
    if (/\/act_1\?/.test(url)) return new Response(JSON.stringify({ name: "Account", account_status: 1, currency: "INR" }), { status: 200 });
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  }) as typeof fetch;
  return () => { global.fetch = original; };
}

async function connection(holderUserId: string, expiresAt: string) {
  return saveWorkspaceConnection({
    holderUserId, metaUserId: "meta-venkat", metaUserName: "Venkat", ownerEmail: "venkatk",
    token: encryptToken("test-token"), tokenExpiresAt: null, scopes: META_SCOPES,
    account: { id: "meta-venkat", name: "Venkat" },
    adAccounts: [{ id: "act_1", accountId: "1", name: "Account", status: 1, currency: "INR" }],
    pages: [], enabledAdAccounts: ["act_1"], connectedAt: new Date().toISOString(), expiresAt, lastSyncAt: null,
  });
}

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri || !process.env.TOKEN_ENCRYPTION_KEY) { console.log("MONGODB_URI and TOKEN_ENCRYPTION_KEY are required"); process.exitCode = 1; return; }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "reachout");
  await Promise.all(["users", "settings", "meta_connection", "meta_notifications", "sessions", "meta_sync_runs", "meta_sync_lock"].map((name) => db.collection(name).deleteMany({})));

  const venkat = await createUser({ username: META_HOLDER_USERNAME, displayName: "Venkat", role: "owner", password: "Correct-Horse-2026!", totpRequired: true, createdBy: null });
  if (!venkat.ok) throw new Error(venkat.error);
  const saketh = await createUser({ username: "saketh", displayName: "Saketh", role: "owner", password: "Correct-Horse-2026!", totpRequired: true, createdBy: null });
  if (!saketh.ok) throw new Error(saketh.error);

  console.log("\n1. Holder resolution and read-only view");
  const holder = await getMetaHolder();
  ok("holder resolves to venkatk", holder?.username === META_HOLDER_USERNAME);
  const conn = await connection(venkat.user._id, new Date(Date.now() + 30 * DAY).toISOString());
  ok("holder is flagged as holder", publicStatus(conn, holder, venkat.user._id).isHolder);
  ok("other owner is read-only", !publicStatus(conn, holder, saketh.user._id).isHolder);
  ok("read-only shows holder name", publicStatus(conn, holder, saketh.user._id).holderName === "Venkat");

  console.log("\n2. Lifetime and reminders");
  const cap = new Date(Date.now() + META_CONNECTION_TTL_MS).getTime();
  ok("60-day cap", Math.abs(new Date(connectionLifetime(new Date().toISOString(), null)).getTime() - cap) < 5000);
  const shortToken = new Date(Date.now() + 5 * DAY).toISOString();
  ok("token expiry wins when shorter", connectionLifetime(new Date().toISOString(), shortToken) === shortToken);
  const restore = graphStub(true);
  await db.collection<{ _id: string }>("meta_connection").updateOne({ _id: "workspace" }, { $set: { expiresAt: new Date(Date.now() + 6 * DAY).toISOString(), lastCheckAt: null } });
  await checkWorkspaceHealth();
  ok("7-day reminder created", Boolean(await db.collection("meta_notifications").findOne({ kind: "meta_expiry", title: /7 days/ })));
  await db.collection<{ _id: string }>("meta_connection").updateOne({ _id: "workspace" }, { $set: { expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() } });
  await checkWorkspaceHealth();
  ok("1-day reminder created", Boolean(await db.collection("meta_notifications").findOne({ kind: "meta_expiry", title: /tomorrow/ })));

  console.log("\n3. debug_token revoke");
  restore();
  const restoreBad = graphStub(false);
  await db.collection<{ _id: string }>("meta_connection").updateOne({ _id: "workspace" }, { $set: { status: "active", expiresAt: new Date(Date.now() + 30 * DAY).toISOString() } });
  await checkWorkspaceHealth();
  restoreBad();
  ok("invalid debug_token marks revoked", (await getWorkspaceConnection())?.status === "revoked");

  console.log("\n4. Holder change revokes");
  await connection(venkat.user._id, new Date(Date.now() + 30 * DAY).toISOString());
  const restoreRevoke = graphStub(true);
  await setMetaHolderUserId(saketh.user._id);
  restoreRevoke();
  ok("holder change deletes the connection", (await getWorkspaceConnection()) === null);
  await db.collection<{ _id: string }>("settings").updateOne({ _id: "meta_holder" }, { $set: { userId: venkat.user._id } });
  await connection(venkat.user._id, new Date(Date.now() + 30 * DAY).toISOString());

  console.log("\n5. Logout and idle keep the connection");
  const token = await createSession({ userId: saketh.user._id, role: "owner", displayName: "Saketh", scope: { caseStudies: [], states: [], parties: [] } });
  await revokeSession(token);
  ok("logout leaves the workspace connection", (await getWorkspaceConnection()) !== null);

  console.log("\n6. Cron sync with nobody signed in");
  const restoreSync = graphStub(true);
  const result = await syncMeta({ trigger: "cron" });
  restoreSync();
  ok("sync runs without a session", result.ok === true, JSON.stringify(result).slice(0, 160));
  ok("sync run recorded", Boolean(await db.collection("meta_sync_runs").findOne({ trigger: "cron" })));

  console.log("\n7. Only the holder can start a connect");
  const sakethToken = await createSession({ userId: saketh.user._id, role: "owner", displayName: "Saketh", scope: { caseStudies: [], states: [], parties: [] } });
  const sakethStart = await startConnect(new NextRequest("https://reachout.test/api/meta/owner/connect/start", { headers: { cookie: `ro_session=${sakethToken}` } }));
  ok("non-holder start is 403", sakethStart.status === 403, String(sakethStart.status));
  const venkatToken = await createSession({ userId: venkat.user._id, role: "owner", displayName: "Venkat", scope: { caseStudies: [], states: [], parties: [] } });
  const venkatStart = await startConnect(new NextRequest("https://reachout.test/api/meta/owner/connect/start", { headers: { cookie: `ro_session=${venkatToken}` } }));
  ok("holder start redirects to Facebook", venkatStart.status === 302 && (venkatStart.headers.get("location") ?? "").includes("facebook.com"), String(venkatStart.status));

  console.log("\n8. Authorize URL and Facebook errors");
  const url = new URL(metaAuthUrl(new NextRequest("https://reachout.test/api/meta/owner/connect/start"), createMetaFlow()));
  ok("dialog uses v27.0", url.pathname.includes("/v27.0/dialog/oauth"));
  ok("no auth_type on a normal connect", !url.searchParams.has("auth_type"));
  const rerequest = new URL(metaAuthUrl(new NextRequest("https://reachout.test/x"), createMetaFlow(), { rerequest: true }));
  ok("Grant again uses rerequest only", rerequest.searchParams.get("auth_type") === "rerequest");
  ok("access_denied maps", facebookFailureReason(new URLSearchParams("error_reason=user_denied&error_code=200")) === "access_denied");
  ok("app role maps", facebookFailureReason(new URLSearchParams("error_description=This app is not available for this user")) === "app_role");
  ok("redirect maps", facebookFailureReason(new URLSearchParams("error_description=redirect_uri is not allowed")) === "redirect");
  ok("other code maps safely", facebookFailureReason(new URLSearchParams("error_code=123")) === "code_123");

  console.log(`\n${pass} passed, ${fail} failed`);
  await client.close();
  process.exit(fail ? 1 : 0);
})().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
