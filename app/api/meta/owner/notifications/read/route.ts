import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { getMetaDb } from "@/lib/meta/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRole(req, ["owner"]);
  if ("deny" in auth) return auth.deny;
  const db = await getMetaDb();
  if (!db) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  const result = await db.collection("meta_notifications").updateMany({ read: false }, { $set: { read: true } });
  return Response.json({ ok: true, read: result.modifiedCount }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
