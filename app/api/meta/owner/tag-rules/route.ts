import type { NextRequest } from "next/server";
import { requireRecentAuth, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { audit } from "@/lib/audit";
import { getMetaDb } from "@/lib/meta/store";
import { applyTagRules, validateRule, type MetaTagRule } from "@/lib/meta/tags";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner"]);
  if ("deny" in auth) return auth.deny;
  const db = await getMetaDb();
  if (!db) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  const rules = await db.collection<MetaTagRule>("meta_tag_rules").find({}).sort({ createdAt: 1 }).toArray();
  return Response.json({ ok: true, rules }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  const db = await getMetaDb();
  if (!db) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

  const parsed = validateRule(await req.json().catch(() => ({})));
  if (!parsed.ok) return Response.json({ ok: false, error: parsed.error }, { status: 400 });

  const rule: MetaTagRule = {
    _id: globalThis.crypto.randomUUID(),
    ...parsed.value,
    createdAt: new Date().toISOString(),
  };
  await db.collection<MetaTagRule>("meta_tag_rules").insertOne(rule);
  const suggestions = await applyTagRules(db).catch(() => 0);
  await audit({ action: "meta_settings", role: "owner", meta: { tagRule: rule._id, state: rule.state, party: rule.party } });
  return Response.json({ ok: true, rule, suggestions }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}

export async function DELETE(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  const db = await getMetaDb();
  if (!db) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return Response.json({ ok: false, error: "Rule id is required" }, { status: 400 });
  await db.collection<MetaTagRule>("meta_tag_rules").deleteOne({ _id: id });
  await db.collection("meta_campaign_tags").deleteMany({ ruleId: id, confirmed: false, source: "rule" });
  await audit({ action: "meta_settings", role: "owner", meta: { deleteTagRule: id } });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
