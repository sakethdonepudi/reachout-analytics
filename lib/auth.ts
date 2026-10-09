import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getMongo } from "@/lib/mongodb";

/* =====================================================================
   Admin/viewer authentication — real server-side sessions.

   Env:
     ADMIN_EMAIL, ADMIN_PASSWORD        (bootstrap admin, first run)
     VIEWER_EMAIL, VIEWER_PASSWORD      (optional bootstrap viewer)
     ADMIN_SESSION_SECRET               (HMAC key for the session cookie)
     ADMIN_RESET_TOKEN                  (password-reset token)
   Secrets live only in env; the session is an HMAC-signed httpOnly cookie.
   ===================================================================== */

export type Role = "admin" | "viewer";
export type Session = { sub: string; role: Role; exp: number };
export const COOKIE = "ro_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const DB = process.env.MONGODB_DB || "reachout";
const secret = process.env.ADMIN_SESSION_SECRET || "";

async function users() {
  const p = getMongo();
  if (!p) return null;
  const client = await p;
  return client.db(DB).collection<{ email: string; role: Role; passwordHash: string; createdAt: string }>("users");
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

export function getSession(req: NextRequest): Session | null {
  return verifySessionToken(req.cookies.get(COOKIE)?.value);
}

/** Returns null when authorized, or a Response to send back (401/403). */
export function requireRole(req: NextRequest, roles: Role[]): { session: Session } | { deny: Response } {
  const s = getSession(req);
  if (!s) return { deny: Response.json({ ok: false, error: "Not authenticated" }, { status: 401 }) };
  if (!roles.includes(s.role)) return { deny: Response.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  return { session: s };
}

export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: MAX_AGE };

/** Create the bootstrap admin/viewer from env if the user store is empty. */
export async function ensureBootstrap() {
  const u = await users();
  if (!u) return;
  const count = await u.countDocuments();
  if (count > 0) return;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPw = process.env.ADMIN_PASSWORD;
  const viewerEmail = process.env.VIEWER_EMAIL;
  const viewerPw = process.env.VIEWER_PASSWORD;
  const docs: { email: string; role: Role; passwordHash: string; createdAt: string }[] = [];
  if (adminEmail && adminPw) docs.push({ email: adminEmail.toLowerCase(), role: "admin", passwordHash: hashPassword(adminPw), createdAt: new Date().toISOString() });
  if (viewerEmail && viewerPw) docs.push({ email: viewerEmail.toLowerCase(), role: "viewer", passwordHash: hashPassword(viewerPw), createdAt: new Date().toISOString() });
  if (docs.length) await u.insertMany(docs);
}

export async function findUser(email: string) {
  const u = await users();
  if (!u) return null;
  return u.findOne({ email: email.toLowerCase() });
}

export async function setPassword(email: string, newPassword: string) {
  const u = await users();
  if (!u) return false;
  const r = await u.updateOne({ email: email.toLowerCase() }, { $set: { passwordHash: hashPassword(newPassword) } });
  return r.matchedCount > 0;
}

export async function authConfigured() {
  return getMongo() !== null && !!secret && !!process.env.ADMIN_EMAIL && !!process.env.ADMIN_PASSWORD;
}
