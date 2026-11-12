import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { getConnectionBySid, getMetaDb } from "@/lib/meta/store";
import { getOwnerOverview, toRangeKey } from "@/lib/meta/overview";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner"]);
  if ("deny" in auth) return auth.deny;
  const db = await getMetaDb();
  if (!db) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  const params = new URL(req.url).searchParams;
  const connection = await getConnectionBySid(auth.session.sid);
  const showAll = params.get("all") === "1";
  const accountIds = showAll ? null : connection ? connection.adAccounts.map((account) => account.id) : [];
  const overview = await getOwnerOverview(db, {
    range: toRangeKey(params.get("range")),
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    state: params.get("state") ?? undefined,
    party: params.get("party") ?? undefined,
    platform: params.get("platform") ?? undefined,
    accountIds,
    connection,
  });
  return Response.json({ ok: true, overview }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
