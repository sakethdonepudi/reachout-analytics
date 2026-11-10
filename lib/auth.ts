import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getMongo } from "@/lib/mongodb";
import type { Role } from "@/lib/access";
import { audit } from "@/lib/audit";

/* =====================================================================
   Sessions and role guards.

   Sign-in is password-only: the owner password and the client password are
   compared in constant time, and the matching password decides the role.
   ===================================================================== */

export type Session = {
  sub: string;
  role: Role;
  exp: number;
  iat: number;
  lastSeen: number;
  authTime: number;
  sid?: string;
};

const DB = process.env.MONGODB_DB || "reachout";
const secret = process.env.ADMIN_SESSION_SECRET || "";

export const ABSOLUTE_MS = 12 * 60 * 60 * 1000;
export const IDLE_MS = 2 * 60 * 60 * 1000;
export const RECENT_MS = 15 * 60 * 1000;
export const LEGACY_COOKIE = "ro_session";
export const COOKIE = process.env.NODE_ENV === "production" ? "__Host-ro_session" : LEGACY_COOKIE;
export const COOKIE_MAX_AGE = Math.floor(ABSOLUTE_MS / 1000);

const normalise = (value: unknown) => String(value ?? "").trim().toLowerCase();

export function subjectForRole(role: Role): string {
  return role;
}

function db() {
  const p = getMongo();
  if (!p) return null;
  return p.then((client) => client.db(DB));
}

async function sessions() {
  try {
    const database = await db();
    if (!database) return null;
    await database.collection("sessions").createIndex({ exp: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
    await database.collection("sessions").createIndex({ sub: 1 }).catch(() => {});
    return database.collection<{
      _id: string; sub: string; role: Role; createdAt: Date; lastSeen: Date; exp: Date; authTime?: Date;
    }>("sessions");
  } catch {
    return null;
  }
}

/* ------------------------------ session tokens ------------------------------ */

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
  const a = Buffer.from(expect);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Session & { role?: string };
    if (!p.exp || Date.now() > p.exp) return null;
    // Legacy password sessions were "admin"; treat them as owner.
    const role: Role | null = p.role === "owner" || p.role === "client" ? p.role : p.role === "admin" ? "owner" : null;
    if (!role) return null;
    return { ...p, role };
  } catch {
    return null;
  }
}

export function getSessionToken(req: NextRequest): string | undefined {
  return req.cookies.get(COOKIE)?.value ?? (COOKIE !== LEGACY_COOKIE ? req.cookies.get(LEGACY_COOKIE)?.value : undefined);
}

export function sessionIsRecent(session: Session): boolean {
  return session.authTime > 0 && Date.now() - session.authTime <= RECENT_MS;
}

/** Create a fresh session id (rotation happens on every sign-in). */
export async function createSession(subject: string, role: Role): Promise<string> {
  const sid = randomBytes(24).toString("base64url");
  const now = Date.now();
  const exp = now + ABSOLUTE_MS;
  const col = await sessions();
  if (!col) throw new Error("Session store unavailable");
  await col.insertOne({
    _id: sid,
    sub: normalise(subject),
    role,
    createdAt: new Date(now),
    lastSeen: new Date(now),
    exp: new Date(exp),
    authTime: new Date(now),
  });
  return signSession({ sub: normalise(subject), role, exp, iat: now, lastSeen: now, authTime: now, sid });
}

export async function getSessionByToken(token: string | undefined): Promise<Session | null> {
  const signed = verifySessionToken(token);
  if (!signed) return null;
  try {
    const col = await sessions();
    if (!col) return null;
    const doc = await col.findOne({ _id: signed.sid ?? "" });
    if (!doc) return null;
    const now = Date.now();
    if (now > doc.exp.getTime() || now - doc.lastSeen.getTime() > IDLE_MS) {
      await col.deleteOne({ _id: doc._id }).catch(() => {});
      return null;
    }
    if (now - doc.lastSeen.getTime() > 60_000) {
      await col.updateOne({ _id: doc._id }, { $set: { lastSeen: new Date(now) } }).catch(() => {});
    }
    return {
      sub: doc.sub,
      role: doc.role,
      exp: doc.exp.getTime(),
      iat: doc.createdAt.getTime(),
      lastSeen: now,
      authTime: doc.authTime ? doc.authTime.getTime() : 0,
      sid: doc._id,
    };
  } catch {
    return null;
  }
}

export async function getSession(req: NextRequest): Promise<Session | null> {
  return getSessionByToken(getSessionToken(req));
}

export async function revokeSession(token: string | undefined) {
  const s = verifySessionToken(token);
  if (!s?.sid) return;
  const col = await sessions();
  if (col) await col.deleteOne({ _id: s.sid });
}

export async function revokeAllSessions(subject: string) {
  const col = await sessions();
  if (col) await col.deleteMany({ sub: normalise(subject) });
}

/** Refresh the recent-auth timestamp after a successful password re-check. */
export async function refreshSessionAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;
  const col = await sessions();
  if (!col) return false;
  const now = new Date();
  const result = await col.updateOne({ _id: sid }, { $set: { authTime: now, lastSeen: now } });
  return result.matchedCount > 0;
}

/* ------------------------------ guards ------------------------------ */

export async function requireRole(req: NextRequest, roles: Role[]): Promise<{ session: Session } | { deny: Response }> {
  const session = await getSession(req);
  if (!session) return { deny: Response.json({ ok: false, error: "Not authenticated" }, { status: 401, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } }) };
  if (!roles.includes(session.role)) {
    await audit({ action: "role_denied", role: session.role, ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() });
    return { deny: Response.json({ ok: false, error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } }) };
  }
  return { session };
}

/** Owner-only alias used by the existing admin/data routes. */
export async function requireAdmin(req: NextRequest): Promise<{ session: Session } | { deny: Response }> {
  return requireRole(req, ["owner"]);
}

export async function requireRecentAuth(req: NextRequest): Promise<{ session: Session } | { deny: Response }> {
  const auth = await requireRole(req, ["owner"]);
  if ("deny" in auth) return auth;
  if (!sessionIsRecent(auth.session)) {
    return { deny: Response.json({ ok: false, error: "Re-authentication required", code: "reauth_required" }, { status: 403, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } }) };
  }
  return auth;
}

/* ------------------------------ cookies ------------------------------ */

export const cookieOptions = {
  name: COOKIE,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: COOKIE_MAX_AGE,
};

export function setSessionCookie(response: Response, token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${secure}`);
}

export function clearSessionCookie(response: Response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
  if (COOKIE !== LEGACY_COOKIE) response.headers.append("Set-Cookie", `${LEGACY_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

export async function authConfigured() {
  try {
    return getMongo() !== null && !!secret;
  } catch {
    return false;
  }
}
