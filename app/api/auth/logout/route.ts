import type { NextRequest } from "next/server";
import { COOKIE, getSessionToken, revokeSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await revokeSession(getSessionToken(req));
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
