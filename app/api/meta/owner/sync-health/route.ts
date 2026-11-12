import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { getMetaDb } from "@/lib/meta/store";
import { getSyncHealth } from "@/lib/meta/sync-health";

export const runtime = "nodejs";

/** Owner-only sync health. No cost fields are exposed here. */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner"]);
  if ("deny" in auth) return auth.deny;
  const db = await getMetaDb();
  if (!db) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  const health = await getSyncHealth(db);
  return Response.json(
    { ok: true, health },
    { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
  );
}
