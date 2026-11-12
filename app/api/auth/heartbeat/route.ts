import type { NextRequest } from "next/server";
import { heartbeat, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

/** Only real user input calls this. Polling never extends a session. */
export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRole(req, ["owner", "client"]);
  if ("deny" in auth) return auth.deny;
  const ok = await heartbeat(auth.session.sid);
  return Response.json({ ok }, { status: ok ? 200 : 401, headers });
}
