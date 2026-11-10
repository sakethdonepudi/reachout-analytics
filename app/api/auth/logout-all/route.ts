import type { NextRequest } from "next/server";
import { clearSessionCookie, getSession, revokeAllSessions } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const session = await getSession(req);
  if (!session) return Response.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  await revokeAllSessions(session.sub);
  await audit({ action: "logout_all", email: session.sub, role: session.role, ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() });
  const res = Response.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
