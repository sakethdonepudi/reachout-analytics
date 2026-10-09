import type { NextRequest } from "next/server";
import { ensureBootstrap, findUser, verifyPassword, signSession, COOKIE, cookieOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  if (!email || !password) return Response.json({ ok: false, error: "Email and password are required" }, { status: 400 });

  await ensureBootstrap();
  const user = await findUser(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return Response.json({ ok: false, error: "Invalid email or password" }, { status: 401 });
  }
  const token = signSession({ sub: user.email, role: user.role, exp: Date.now() + cookieOptions.maxAge * 1000 });
  const res = Response.json({ ok: true, email: user.email, role: user.role });
  const cookie = `${COOKIE}=${token}; Path=${cookieOptions.path}; HttpOnly; SameSite=Lax; Max-Age=${cookieOptions.maxAge}${cookieOptions.secure ? "; Secure" : ""}`;
  res.headers.append("Set-Cookie", cookie);
  return res;
}
