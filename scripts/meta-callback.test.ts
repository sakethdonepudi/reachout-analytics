/* Cross-site Meta callback tests: no session cookie, signed state cookie only. */

import { MongoClient } from "mongodb";
import { NextRequest } from "next/server";
import { signPayload } from "@/lib/signed-cookie";
import { GET } from "@/app/api/meta/owner/connect/callback/route";
import { validateConnectState } from "@/lib/meta/connect-callback";
import { createUser, hashPassword } from "@/lib/users";

let pass = 0, fail = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

const secret = process.env.ADMIN_SESSION_SECRET ?? "";
const stateValue = "state-cross-site";
const verifier = "verifier-cross-site";

function stateCookie(payload: Record<string, unknown>, ttl = 10 * 60 * 1000): string {
  return `ro_meta_state=${signPayload(payload, secret, ttl)}`;
}

async function callback(cookie?: string, state = stateValue, code = "test-code"): Promise<{ status: number; body: string; headers: Headers }> {
  const url = `http://localhost/api/meta/owner/connect/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
  const req = new NextRequest(url, { headers: cookie ? { cookie } : {} });
  const res = await GET(req);
  return { status: res.status, body: await res.text(), headers: res.headers };
}

function installGraphStub() {
  const original = global.fetch;
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/oauth/access_token")) return new Response(JSON.stringify({ access_token: "test-token", expires_in: 3600 }), { status: 200 });
    if (url.includes("/me/adaccounts")) return new Response(JSON.stringify({ data: [{ id: "act_1", account_id: "1", name: "Account", account_status: 1, currency: "INR" }] }), { status: 200 });
    if (url.includes("/me/accounts")) return new Response(JSON.stringify({ data: [] }), { status: 200 });
    if (url.includes("/me/permissions")) return new Response(JSON.stringify({ data: [{ permission: "ads_read", status: "granted" }] }), { status: 200 });
    if (url.includes("/me")) return new Response(JSON.stringify({ id: "meta-user-1", name: "Meta User" }), { status: 200 });
    if (url.includes("/me/permissions")) return new Response(JSON.stringify({ success: true }), { status: 200 });
    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof fetch;
  return () => { global.fetch = original; };
}

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri || !secret) { console.log("MONGODB_URI and ADMIN_SESSION_SECRET are required"); process.exitCode = 1; return; }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "reachout");
  await Promise.all(["meta_connection", "meta_connect_states", "sessions", "users"].map((name) => db.collection(name).deleteMany({})));

  const owner = await createUser({ username: "owner-cb", displayName: "Owner Callback", role: "owner", password: "Correct-Horse-2026!", totpRequired: true, createdBy: null });
  if (!owner.ok) throw new Error(owner.error);
  const clientUser = await createUser({ username: "client-cb", displayName: "Client Callback", role: "client", password: "Correct-Horse-2026!", createdBy: null });
  if (!clientUser.ok) throw new Error(clientUser.error);
  const sid = "sid-owner-callback";
  const exp = new Date(Date.now() + 60 * 60 * 1000);
  await db.collection("sessions").insertOne({ _id: sid, sub: owner.user._id, userId: owner.user._id, role: "owner", createdAt: new Date(), lastSeen: new Date(Date.now() - 5 * 60 * 1000), exp, authTime: new Date(), graceUntil: new Date(Date.now() + 10 * 60 * 1000) });
  const payload = { state: stateValue, verifier, sid, userId: owner.user._id, next: "/meta-ads/settings" };
  const cookie = stateCookie(payload);

  console.log("\n1. Cross-site callback with no session cookie");
  const restore = installGraphStub();
  const first = await callback(cookie);
  restore();
  ok("returns 200 HTML, not 401 JSON", first.status === 200 && first.headers.get("content-type")?.includes("text/html"), String(first.status));
  ok("bounce targets connected", first.body.includes("connected=1") && first.body.includes('http-equiv="refresh"'));
  ok("bounce has a plain link", first.body.includes("<a href="));
  ok("bounce has no inline script", !/<script/i.test(first.body));
  ok("cache and referrer headers", first.headers.get("cache-control")?.includes("no-store") === true && first.headers.get("referrer-policy") === "no-referrer");
  const stored = await db.collection("meta_connection").findOne({ sid });
  ok("connection stored without a session cookie", Boolean(stored) && stored?.userId === owner.user._id && stored?.metaUserName === "Meta User", JSON.stringify(stored ?? null).slice(0, 160));
  ok("state cookie cleared", first.headers.get("set-cookie")?.includes("ro_meta_state=;") === true);

  console.log("\n2. Replay and invalid states");
  await db.collection("sessions").updateOne({ _id: sid }, { $set: { lastSeen: new Date(), graceUntil: new Date(Date.now() + 60_000) } });
  const replay = await callback(cookie);
  ok("replayed state fails", replay.body.includes("error=state") && !replay.body.includes("connected=1"));
  await db.collection("meta_connection").deleteMany({});
  const mismatch = await callback(stateCookie({ ...payload, state: "other-state" }), stateValue);
  ok("mismatched state fails", mismatch.body.includes("error=state"));
  const expired = await callback(stateCookie(payload, -1000));
  ok("expired cookie fails", expired.body.includes("error=session"));
  const unknown = await callback(stateCookie({ ...payload, sid: "unknown-sid" }));
  ok("unknown session fails", unknown.body.includes("error=session"));
  const clientOwner = await callback(stateCookie({ ...payload, sid: "client-sid", userId: clientUser.user._id }));
  ok("non-owner fails", clientOwner.body.includes("error=session"));
  const anonymous = await callback();
  ok("anonymous callback is a bounce, not JSON", anonymous.status === 200 && anonymous.body.includes("error=session") && !/<script/i.test(anonymous.body));

  console.log("\n3. Validation guards");
  const session = { _id: sid, userId: owner.user._id, role: "owner" as const, exp, lastSeen: new Date(), graceUntil: new Date(Date.now() + 60_000) };
  ok("disabled user rejected", !validateConnectState({ stored: payload as never, state: stateValue, session, user: { ...owner.user, status: "disabled" } }).ok);
  ok("non-owner user rejected", !validateConnectState({ stored: payload as never, state: stateValue, session, user: { ...clientUser.user } }).ok);
  ok("expired session rejected", !validateConnectState({ stored: payload as never, state: stateValue, session: { ...session, exp: new Date(Date.now() - 1000) }, user: owner.user }).ok);
  ok("valid state accepted", validateConnectState({ stored: payload as never, state: stateValue, session, user: owner.user }).ok);

  console.log(`\n${pass} passed, ${fail} failed`);
  await client.close();
  process.exit(fail ? 1 : 0);
})().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
