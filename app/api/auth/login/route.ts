import type { NextRequest } from "next/server";
import { ensureAdmin, verifyPassword, createSession, COOKIE, cookieOptions, loginRateLimited, clearLoginAttempts } from "@/lib/auth";
import { getMongo } from "@/lib/mongodb";

export const runtime = "nodejs";

/** Password-only admin login. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (loginRateLimited(ip)) {
    return Response.json({ ok: false, error: "Too many attempts — please try again later." }, { status: 429 });
  }

  let body: { password?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const password = String(body.password ?? "");
  if (!password) return Response.json({ ok: false, error: "Password is required" }, { status: 400 });

  const ready = await ensureAdmin();
  if (!ready.ok) return Response.json({ ok: false, error: ready.reason || "Sign-in is not configured" }, { status: 503 });

  const p = getMongo();
  const client = await p!;
  const user = await client.db(process.env.MONGODB_DB || "reachout").collection<{ email: string; role: "admin"; passwordHash: string }>("users").findOne({ email: "admin@reachout.local" });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return Response.json({ ok: false, error: "Incorrect password" }, { status: 401 });
  }

  clearLoginAttempts(ip);
  const token = await createSession(user.email, "admin");
  const res = Response.json({ ok: true, role: "admin" });
  res.headers.append("Set-Cookie", `${COOKIE}=${token}; Path=${cookieOptions.path}; HttpOnly; SameSite=Lax; Max-Age=${cookieOptions.maxAge}${cookieOptions.secure ? "; Secure" : ""}`);
  return res;
}
