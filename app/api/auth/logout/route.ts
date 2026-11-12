import type { NextRequest } from "next/server";
import { clearSessionCookie, getSession, getSessionToken, revokeSession } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { audit } from "@/lib/audit";
import { cleanupSessionConnection } from "@/lib/meta/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const session = await getSession(req);
  await cleanupSessionConnection(session?.sid, "logout").catch(() => {});
  await revokeSession(getSessionToken(req));
  await audit({ action: "logout", email: session?.sub, role: session?.role, ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() });
  const res = Response.json({ ok: true });
  clearSessionCookie(res);
  res.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
  return res;
}
