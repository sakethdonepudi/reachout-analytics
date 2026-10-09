import type { NextRequest } from "next/server";
import { setPassword } from "@/lib/auth";

export const runtime = "nodejs";

/** Password reset. Requires the server-side reset token (ADMIN_RESET_TOKEN). */
export async function POST(req: NextRequest) {
  let body: { email?: string; token?: string; newPassword?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const email = String(body.email ?? "").trim();
  const token = String(body.token ?? "");
  const newPassword = String(body.newPassword ?? "");
  const expected = process.env.ADMIN_RESET_TOKEN;

  if (!expected) return Response.json({ ok: false, error: "Password reset is not configured on this deployment" }, { status: 503 });
  if (!email || token !== expected || newPassword.length < 8) {
    return Response.json({ ok: false, error: "Invalid reset request (token must match and password must be at least 8 characters)" }, { status: 400 });
  }
  const done = await setPassword(email, newPassword);
  if (!done) return Response.json({ ok: false, error: "Account not found" }, { status: 404 });
  return Response.json({ ok: true });
}
