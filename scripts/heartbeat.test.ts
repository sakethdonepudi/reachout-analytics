/**
 * Heartbeat and idle expiry test.
 *
 * An active, visible TN page keeps the session alive; a hidden or idle page
 * does not. Uses the local Mongo session store. Skips without local artifacts.
 */
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { MongoClient } from "mongodb";
import { chromium } from "playwright-core";

const BASE = process.env.SESSION_TEST_BASE ?? "http://localhost:3101";
const uri = process.env.MONGODB_URI;
const secret = process.env.ADMIN_SESSION_SECRET;
if (!uri || !secret || !existsSync(".context/owner-cookie.txt")) {
  console.log("Heartbeat test skipped: MONGODB_URI, ADMIN_SESSION_SECRET or local cookies are missing.");
  process.exit(0);
}

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
  return `${body}.${createHmac("sha256", secret!).update(body).digest("base64url")}`;
}

function sidFromCookie(file: string) {
  const token = readFileSync(file, "utf8").trim().split("=").slice(1).join("=");
  return (JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString()) as { sid?: string }).sid ?? "";
}

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = "") => { if (ok) pass += 1; else fail += 1; console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`); };

(async () => {
  const mongo = new MongoClient(uri);
  await mongo.connect();
  const sessions = mongo.db(process.env.MONGODB_DB || "reachout").collection<Record<string, unknown> & { _id: string }>("sessions");
  const owner = await sessions.findOne({ _id: sidFromCookie(".context/owner-cookie.txt") });
  if (!owner) { console.log("Heartbeat test skipped: owner session not found."); await mongo.close(); return; }

  const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  try {
    // Active and visible: a 9m50s idle session gets a heartbeat on interaction.
    await sessions.updateOne({ _id: owner._id }, { $set: { lastSeen: new Date(Date.now() - 590_000) } });
    const activeToken = tokenFor({ ...owner, lastSeen: new Date(Date.now() - 590_000) });
    const activeContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await activeContext.addCookies([{ name: "ro_session", value: activeToken, domain: "localhost", path: "/" }]);
    const page = await activeContext.newPage();
    await page.goto(`${BASE}/case-studies/tamil-nadu?view=op`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.mouse.move(300, 300);
    await page.mouse.move(320, 340);
    await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
    await page.waitForTimeout(1800);
    const afterHeartbeat = await sessions.findOne({ _id: owner._id });
    check("active visible page heartbeats", Boolean(afterHeartbeat) && Date.now() - new Date(afterHeartbeat!.lastSeen as Date).getTime() < 60_000, `age ${afterHeartbeat ? Math.round((Date.now() - new Date(afterHeartbeat.lastSeen as Date).getTime()) / 1000) : "?"}s`);
    const sessionResponse = await page.evaluate(async () => (await fetch("/api/auth/session")).status);
    check("active page stays signed in", sessionResponse === 200, `status ${sessionResponse}`);
    await activeContext.close();

    // Idle past the limit: no heartbeat, server rejects and clears the cookie.
    const sid = randomUUID();
    const base = { ...owner, _id: sid, createdAt: new Date(), authTime: new Date(), lastSeen: new Date(Date.now() - 650_000), exp: new Date(Date.now() + 60 * 60 * 1000) };
    await sessions.insertOne(base);
    const idleToken = tokenFor(base);
    const idleContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await idleContext.addCookies([{ name: "ro_session", value: idleToken, domain: "localhost", path: "/" }]);
    const idlePage = await idleContext.newPage();
    await idlePage.goto(`${BASE}/case-studies/tamil-nadu?view=op`, { waitUntil: "domcontentloaded" });
    await idlePage.waitForTimeout(900);
    const url = new URL(idlePage.url());
    const cookies = await idleContext.cookies();
    const gone = await sessions.findOne({ _id: sid });
    check("idle page expires", url.pathname === "/login" && url.searchParams.get("reason") === "expired" && !gone, `final ${url.pathname}${url.search}`);
    check("idle rejection clears the cookie", !cookies.some((cookie) => cookie.name === "ro_session" && cookie.value.length > 20), `cookies ${cookies.map((cookie) => cookie.name).join(", ")}`);
    await idleContext.close();
  } finally {
    await browser.close();
    await mongo.close();
  }

  console.log(`\nHEARTBEAT ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})().catch((error) => { console.error(error); process.exit(1); });
