import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { getMetaDb } from "@/lib/meta/store";
import { getCreativeView } from "@/lib/meta/creative";
import { toRangeKey } from "@/lib/meta/overview";

export const runtime = "nodejs";

export async function GET(req: NextRequest, context: { params: Promise<{ adId: string }> }) {
  const auth = await requireRole(req, ["owner"]);
  if ("deny" in auth) return auth.deny;
  const db = await getMetaDb();
  if (!db) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  const { adId } = await context.params;
  const params = new URL(req.url).searchParams;
  const creative = await getCreativeView(db, adId, params.get("state"), true, toRangeKey(params.get("range")), params.get("platform") ?? "all");
  if (!creative) return Response.json({ ok: false, error: "Creative not found" }, { status: 404 });
  return Response.json({ ok: true, creative }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
