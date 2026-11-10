import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getMongo } from "@/lib/mongodb";
import type { Role } from "@/lib/access";
import { audit } from "@/lib/audit";

/* =====================================================================
   Sessions, roles and allowlists.

   Google is the primary sign-in. The owner break-glass password remains
   available only when BREAKGLASS_LOGIN_ENABLED=true.
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
export const BREAKGLASS_EMAIL = "admin@reachout.local";

const normalise = (value: unknown) => String(value ?? "").trim().toLowerCase();

export function parseEmailList(value: string | undefined): string[] {
  return [...new Set(String(value ?? "").split(",").map(normalise).filter((email) => email.includes("@")))];
}

export function ownerEmails(): string[] {
  return parseEmailList(process.env.OWNER_EMAILS);
}

export function envClientEmails(): string[] {
  return parseEmailList(process.env.CLIENT_EMAILS);
}

async function db() {
  const p = getMongo();
  if (!p) return null;
  const client = await p;
  return client.db(DB);
}

async function sessions() {
  const database = await db();
  if (!database) return null;
  await database.collection("sessions").createIndex({ exp: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
  await database.collection("sessions").createIndex({ sub: 1 }).catch(() => {});
  return database.collection<{
    _id: string; sub: string; role: Role; createdAt: Date; lastSeen: Date; exp: Date; authTime?: Date;
  }>("sessions");
}

async function accessEmails() {
  const database = await db();
  if (!database) return null;
  return database.collection<{ _id: string; email: string; role: "client"; addedBy: string; addedAt: string }>("access_emails");
}

async function users() {
  const database = await db();
  if (!database) return null;
  return database.collection<{ email: string; role: Role; passwordHash: string; createdAt: string; updatedAt?: string }>("users");
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

/* ------------------------------ allowlists ------------------------------ */

export async function clientsInDb(): Promise<string[]> {
  const col = await accessEmails();
  if (!col) return [];
  const rows = await col.find({ role: "client" }).toArray();
  return rows.map((row) => normalise(row.email));
}

/** Pure list resolver, used by tests and by the live Mongo-backed lookup. */
export function roleFromLists(email: string, owners: string[], envClients: string[], savedClients: string[]): Role | null {
  const e = normalise(email);
  if (!e) return null;
  if (owners.map(normalise).includes(e)) return "owner";
  if (envClients.map(normalise).includes(e)) return "client";
  if (savedClients.map(normalise).includes(e)) return "client";
  return null;
}

export async function roleForEmail(email: string): Promise<Role | null> {
  return roleFromLists(email, ownerEmails(), envClientEmails(), await clientsInDb());
}

export async function listClientEmails(): Promise<string[]> {
  const owners = new Set(ownerEmails());
  return [...new Set([...envClientEmails(), ...(await clientsInDb())])].filter((email) => !owners.has(email)).sort();
}

export async function addClientEmail(email: string, addedBy: string): Promise<{ ok: boolean; reason?: string }> {
  const e = normalise(email);
  if (!e.includes("@")) return { ok: false, reason: "Enter a valid email address" };
  if (ownerEmails().includes(e)) return { ok: false, reason: "Owner emails are managed by the OWNER_EMAILS environment variable" };
  const col = await accessEmails();
  if (!col) return { ok: false, reason: "Database not configured" };
  await col.updateOne(
    { _id: e },
    { $set: { email: e, role: "client", addedBy: normalise(addedBy), addedAt: new Date().toISOString() } },
    { upsert: true },
  );
  return { ok: true };
}

export async function removeClientEmail(email: string): Promise<{ ok: boolean; reason?: string }> {
  const e = normalise(email);
  if (ownerEmails().includes(e)) return { ok: false, reason: "Owner emails cannot be removed in the UI" };
  const col = await accessEmails();
  if (!col) return { ok: false, reason: "Database not configured" };
  await col.deleteOne({ _id: e, role: "client" });
  return { ok: true };
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
export async function createSession(email: string, role: Role): Promise<string> {
  const sid = randomBytes(24).toString("base64url");
  const now = Date.now();
  const exp = now + ABSOLUTE_MS;
  const col = await sessions();
  if (col) {
    await col.insertOne({
      _id: sid,
      sub: normalise(email),
      role,
      createdAt: new Date(now),
      lastSeen: new Date(now),
      exp: new Date(exp),
      authTime: new Date(now),
    });
  }
  return signSession({ sub: normalise(email), role, exp, iat: now, lastSeen: now, authTime: now, sid });
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

export async function revokeAllSessions(email: string) {
  const col = await sessions();
  if (col) await col.deleteMany({ sub: normalise(email) });
}

/* ------------------------------ guards ------------------------------ */

export async function requireRole(req: NextRequest, roles: Role[]): Promise<{ session: Session } | { deny: Response }> {
  const session = await getSession(req);
  if (!session) return { deny: Response.json({ ok: false, error: "Not authenticated" }, { status: 401, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } }) };
  if (!roles.includes(session.role)) {
    await audit({ action: "role_denied", email: session.sub, role: session.role, ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() });
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

/* ------------------------------ break-glass ------------------------------ */

export async function ensureBreakglassAdmin(): Promise<{ ok: boolean; reason?: string }> {
  if (process.env.BREAKGLASS_LOGIN_ENABLED !== "true") return { ok: false, reason: "Break-glass login is disabled" };
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return { ok: false, reason: "ADMIN_PASSWORD is not configured" };
  const u = await users();
  if (!u) return { ok: false, reason: "Database not configured (MONGODB_URI missing)" };
  const now = new Date().toISOString();
  const existing = await u.findOne({ email: BREAKGLASS_EMAIL });
  if (!existing) {
    await u.insertOne({ email: BREAKGLASS_EMAIL, role: "owner", passwordHash: hashPassword(pw), createdAt: now, updatedAt: now });
    return { ok: true };
  }
  if (!verifyPassword(pw, existing.passwordHash) || existing.role !== "owner") {
    await u.updateOne({ email: BREAKGLASS_EMAIL }, { $set: { passwordHash: hashPassword(pw), role: "owner", updatedAt: now } });
  }
  return { ok: true };
}

/** Kept for compatibility with older callers. */
export const ensureAdmin = ensureBreakglassAdmin;

export async function authConfigured() {
  return getMongo() !== null && !!secret;
}

const breakglassAttempts = new Map<string, { count: number; reset: number }>();
const BREAKGLASS_LIMIT = 5;
const BREAKGLASS_WINDOW = 60 * 60 * 1000;

export function breakglassRateLimited(ip: string): boolean {
  const now = Date.now();
  const attempt = breakglassAttempts.get(ip);
  if (!attempt || attempt.reset < now) {
    breakglassAttempts.set(ip, { count: 1, reset: now + BREAKGLASS_WINDOW });
    return false;
  }
  attempt.count += 1;
  return attempt.count > BREAKGLASS_LIMIT;
}
