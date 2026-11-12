import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { denyCase } from "@/lib/session-scope";
import { HISTORY } from "@/lib/telangana/history";

export const runtime = "nodejs";

/** Protected historical bundle without the device breakdown. */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "client"]);
  if ("deny" in auth) return auth.deny;
  const denied = denyCase(auth.session, "telangana");
  if (denied) return denied;
  const history = {
    version: HISTORY.version,
    cutoff: HISTORY.cutoff,
    groups: HISTORY.groups,
    groupLabels: HISTORY.groupLabels,
    winnerColours: HISTORY.winnerColours,
    sa: HISTORY.sourceAudit,
    cw: HISTORY.crosswalk,
    years: HISTORY.years,
    stats: HISTORY.stats,
  };
  return Response.json({ ok: true, history }, {
    headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" },
  });
}
