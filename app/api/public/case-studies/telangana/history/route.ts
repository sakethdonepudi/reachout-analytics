import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { denyCase } from "@/lib/session-scope";
import { getClientHistory } from "@/lib/telangana/history-server";

export const runtime = "nodejs";

/** Protected historical bundle without the device breakdown. */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "client"]);
  if ("deny" in auth) return auth.deny;
  const denied = await denyCase(auth.session, "telangana");
  if (denied) return denied;
  const history = getClientHistory();
  return Response.json({ ok: true, history }, {
    headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" },
  });
}
