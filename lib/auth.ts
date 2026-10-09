import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getMongo } from "@/lib/mongodb";

/* =====================================================================
   Single internal admin account — password-only login.

   Env (server-side only):
     ADMIN_PASSWORD        the admin password (never hardcoded / committed)
     ADMIN_SESSION_SECRET  HMAC key for the session cookie

   Stored as a scrypt hash in MongoDB. The password is updated safely from
   the env when it changes — datasets are never touched. Sessions are
   HMAC-signed httpOnly cookies with an expiry.
   ===================================================================== */

export type Session = { sub: string; role: "admin"; exp: number; sid?: string };
export const COOKIE = "ro_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const ADMIN_ID = "admin@reachout.local";

const DB = process.env.MONGODB_DB || "reachout";
const secret = process.env.ADMIN_SESSION_SECRET || "";

async function users() {
  const p = getMongo();
  if (!p) return null;
  const client = await p;
  return client.db(DB).collection<{ email: string; role: "admin"; passwordHash: string; createdAt: string; updatedAt?: string }>("users");
}

async function sessions() {
  const p = getMongo();
  if (!p) return null;
  const client = await p;
  const db = client.db(DB);
  await db.collection("sessions").createIndex({ exp: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
  return db.collection<{ _id: string; sub: string; role: "admin"; exp: Date }>("sessions");
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  const h = scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${h}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, h] = stored.split(":");
  if (!salt || !h) return false;
  const a = Buffer.from(h, "hex");
  const b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signSession(payload: Session): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}
export function verifySessionToken(token: string | undefined): Session | null {
  if (!secret || !token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expect = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(expect), b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    if (!p.exp || Date.now() > p.exp) return null;
    return p;
  } catch {
    return null;
  }
}

export function getSessionToken(req: NextRequest): string | undefined {
  return req.cookies.get(COOKIE)?.value;
}

export async function createSession(sub: string, role: "admin"): Promise<string> {
  const sid = randomBytes(24).toString("base64url");
  const exp = Date.now() + MAX_AGE * 1000;
  const col = await sessions();
  if (col) await col.insertOne({ _id: sid, sub, role, exp: new Date(exp) });
  return signSession({ sub, role, exp, sid });
}

/** Verifies the cookie signature AND that the server-side session still exists. */
export async function getSession(req: NextRequest): Promise<Session | null> {
  const s = verifySessionToken(getSessionToken(req));
  if (!s) return null;
  const col = await sessions();
  if (!col) return null;
  const doc = await col.findOne({ _id: s.sid ?? "" });
  if (!doc) return null;
  return s;
}

/** Revoke a session server-side (so logout invalidates the cookie immediately). */
export async function revokeSession(token: string | undefined) {
  const s = verifySessionToken(token);
  if (s?.sid) { const col = await sessions(); if (col) await col.deleteOne({ _id: s.sid }); }
}

/** Returns null when authorized, or a Response to send back (401). */
export async function requireAdmin(req: NextRequest): Promise<{ session: Session } | { deny: Response }> {
  const s = await getSession(req);
  if (!s || s.role !== "admin") return { deny: Response.json({ ok: false, error: "Not authenticated" }, { status: 401 }) };
  return { session: s };
}

export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: MAX_AGE };

/**
 * Ensure the single admin account exists and matches ADMIN_PASSWORD.
 * Only the users collection is touched — poll datasets are never modified.
 */
export async function ensureAdmin(): Promise<{ ok: boolean; reason?: string }> {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return { ok: false, reason: "ADMIN_PASSWORD is not configured" };
  const u = await users();
  if (!u) return { ok: false, reason: "Database not configured (MONGODB_URI missing)" };
  const existing = await u.findOne({ email: ADMIN_ID });
  const now = new Date().toISOString();
  if (!existing) {
    await u.insertOne({ email: ADMIN_ID, role: "admin", passwordHash: hashPassword(pw), createdAt: now, updatedAt: now });
    return { ok: true };
  }
  if (!verifyPassword(pw, existing.passwordHash)) {
    await u.updateOne({ email: ADMIN_ID }, { $set: { passwordHash: hashPassword(pw), role: "admin", updatedAt: now } });
  }
  return { ok: true };
}

export async function authConfigured() {
  return getMongo() !== null && !!secret && !!process.env.ADMIN_PASSWORD;
}

/* ---- best-effort per-instance login rate limiting ---- */
const attempts = new Map<string, { count: number; reset: number }>();
const LIMIT = 5;
const WINDOW = 15 * 60 * 1000;
export function loginRateLimited(ip: string): boolean {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || a.reset < now) { attempts.set(ip, { count: 1, reset: now + WINDOW }); return false; }
  a.count += 1;
  return a.count > LIMIT;
}
export function clearLoginAttempts(ip: string) { attempts.delete(ip); }
