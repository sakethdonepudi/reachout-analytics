import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { getConnectionBySid, getMetaDb } from "@/lib/meta/store";
import { getClientState } from "@/lib/meta/client-dto";
import { toRangeKey } from "@/lib/meta/overview";

export const runtime = "nodejs";

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const auth = await requireRole(req, ["owner"]);
  if ("deny" in auth) return auth.deny;
  const db = await getMetaDb();
  if (!db) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  const { slug } = await context.params;
  const params = new URL(req.url).searchParams;
  const connection = await getConnectionBySid(auth.session.sid);
  const accountIds = connection ? connection.adAccounts.map((account) => account.id) : [];
  const state = await getClientState(db, slug, {
    range: toRangeKey(params.get("range")),
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    platform: params.get("platform") ?? undefined,
    accountIds,
    connection,
  }, true);
  return Response.json({ ok: true, state }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
