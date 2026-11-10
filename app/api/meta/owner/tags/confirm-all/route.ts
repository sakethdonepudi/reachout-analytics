import type { NextRequest } from "next/server";
import { requireRecentAuth } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { audit } from "@/lib/audit";
import { getMetaDb } from "@/lib/meta/store";
import type { MetaCampaignTag } from "@/lib/meta/tags";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  const db = await getMetaDb();
  if (!db) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

  const result = await db.collection<MetaCampaignTag & { _id: string }>("meta_campaign_tags").updateMany(
    { confirmed: false },
    { $set: { confirmed: true, updatedAt: new Date().toISOString() } },
  );
  await audit({ action: "meta_settings", role: "owner", meta: { confirmAllTags: result.modifiedCount } });
  return Response.json({ ok: true, confirmed: result.modifiedCount }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
