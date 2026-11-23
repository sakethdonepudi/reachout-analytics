/**
 * Session rejection loop test.
 *
 * Creates validly signed but revoked or idle-expired sessions in the local
 * Mongo database, then visits "/", "/login", "/dashboard" and the TN case
 * study as owner and client. Each visit must land on a visible page within two
 * redirects.
 *
 * Local run:
 *   ADMIN_SESSION_SECRET="$(cat .context/.admin-secret)" \
 *   MONGODB_URI="$(cat .context/.test-mongo-uri)" \
 *   npx tsx --conditions react-server scripts/session-loop.test.ts
 *
 * Skips when the local server, Mongo, secret or seeded cookies are missing.
 */
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { MongoClient } from "mongodb";
import { chromium } from "playwright-core";

const BASE = process.env.SESSION_TEST_BASE ?? "http://localhost:3101";
const uri = process.env.MONGODB_URI;
const secret = process.env.ADMIN_SESSION_SECRET;
const ownerFile = ".context/owner-cookie.txt";
const clientFile = ".context/client-cookie.txt";
if (!uri || !secret || !existsSync(ownerFile) || !existsSync(clientFile)) {
  console.log("Session loop test skipped: MONGODB_URI, ADMIN_SESSION_SECRET or local cookies are missing.");
  process.exit(0);
}

type Row = Record<string, unknown> & { _id: string; role: string };
const PAGES = ["/", "/login", "/dashboard", "/case-studies/tamil-nadu"];

function tokenFor(session: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify({
    sub: session.sub,
    role: session.role,
    exp: new Date(session.exp as Date).getTime(),
    iat: new Date(session.createdAt as Date).getTime(),
    lastSeen: new Date(session.lastSeen as Date).getTime(),
    authTime: session.authTime ? new Date(session.authTime as Date).getTime() : 0,
    sid: session._id,
    userId: session.userId,
    displayName: session.displayName,
  })).toString("base64url");
  const signature = createHmac("sha256", secret!).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function sidFromCookie(file: string) {
  const token = readFileSync(file, "utf8").trim().split("=").slice(1).join("=");
  const body = token.split(".")[0];
  try {
    return (JSON.parse(Buffer.from(body, "base64url").toString()) as { sid?: string }).sid ?? "";
  } catch {
    return "";
  }
}

let pass = 0;
let fail = 0;
function record(label: string, ok: boolean, detail: string) {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

(async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const sessions = client.db(process.env.MONGODB_DB || "reachout").collection<Row>("sessions");
  const sourceOwner = await sessions.findOne({ _id: sidFromCookie(ownerFile) });
  const sourceClient = await sessions.findOne({ _id: sidFromCookie(clientFile) });
  if (!sourceOwner || !sourceClient) {
    console.log("Session loop test skipped: the seeded owner or client session is not in Mongo.");
    await client.close();
    return;
  }

  const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  for (const [role, source] of [["owner", sourceOwner], ["client", sourceClient]] as const) {
    for (const scenario of ["revoked", "idle"] as const) {
      for (const path of PAGES) {
        const sid = randomUUID();
        const base = { ...source, _id: sid, createdAt: new Date(), authTime: new Date(), lastSeen: new Date(), exp: new Date(Date.now() + 60 * 60 * 1000) };
        if (scenario === "idle") base.lastSeen = new Date(Date.now() - 11 * 60 * 1000);
        else await sessions.deleteOne({ _id: sid });
        if (scenario === "idle") await sessions.insertOne(base);
        const token = tokenFor(base);
        if (scenario === "revoked") await sessions.deleteOne({ _id: sid });

        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        await context.addCookies([{ name: "ro_session", value: token, domain: "localhost", path: "/" }]);
        const page = await context.newPage();
        let redirects = 0;
        page.on("response", (response) => {
          if (response.request().isNavigationRequest() && response.status() >= 300 && response.status() < 400) redirects += 1;
        });
        const response = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1300);
        const body = await page.locator("body").innerText().catch(() => "");
        const url = new URL(page.url());
        const visible = body.trim().length > 20;
        const onLogin = url.pathname === "/login";
        const expected = path === "/" ? url.pathname === "/" : onLogin || (path === "/dashboard" && url.pathname === "/no-access");
        record(`${role} ${scenario} ${path}`, visible && expected && redirects <= 2, `final ${url.pathname}${url.search} status ${response?.status() ?? "?"} redirects ${redirects} body ${body.length}`);
        if (scenario === "idle") await sessions.deleteOne({ _id: sid });
        await context.close();
      }
    }
  }
  {
    const sid = randomUUID();
    const base = { ...sourceOwner, _id: sid, createdAt: new Date(), authTime: new Date(), lastSeen: new Date(), exp: new Date(Date.now() + 60 * 60 * 1000) };
    const token = tokenFor(base);
    await sessions.deleteOne({ _id: sid });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([{ name: "ro_session", value: token, domain: "localhost", path: "/" }, { name: "ro_auth_loop", value: "2", domain: "localhost", path: "/" }]);
    const page = await context.newPage();
    let redirects = 0;
    page.on("response", (response) => { if (response.request().isNavigationRequest() && response.status() >= 300 && response.status() < 400) redirects += 1; });
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const url = new URL(page.url());
    const body = await page.locator("body").innerText().catch(() => "");
    record("loop guard owner revoked /dashboard", url.pathname === "/login" && redirects === 0 && body.trim().length > 20, `final ${url.pathname}${url.search} redirects ${redirects}`);
    await context.close();
  }

  await browser.close();
  await client.close();
  console.log(`\nSESSION LOOP ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})().catch((error) => { console.error(error); process.exit(1); });
