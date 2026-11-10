import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { recentAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner"]);
  if ("deny" in auth) return auth.deny;
  const limit = Math.min(200, Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? 100)));
  return Response.json({ ok: true, rows: await recentAudit(limit) }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
