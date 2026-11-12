import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireRecentAuth } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { audit } from "@/lib/audit";
import { getConnectionBySid, setEnabledAdAccounts } from "@/lib/meta/store";
import { metaConfigured } from "@/lib/meta/oauth";

export const runtime = "nodejs";
const Body = z.object({ adAccountIds: z.array(z.string().max(120)).max(200) });

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  if (!metaConfigured()) {
    return Response.json(
      { ok: false, error: "Meta app not configured" },
      { status: 503, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
    );
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });
  const doc = await getConnectionBySid(auth.session.sid);
  if (!doc) return Response.json({ ok: false, error: "Meta is not connected" }, { status: 404 });
  const allowed = new Set(doc.adAccounts.map((account) => account.id));
  const ids = [...new Set(parsed.data.adAccountIds)].filter((id) => allowed.has(id));
  await setEnabledAdAccounts(auth.session.sid, ids);
  await audit({ action: "meta_settings", email: auth.session.sub, role: "owner", ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim(), meta: { adAccounts: ids.length } });
  return Response.json({ ok: true, enabledAdAccounts: ids });
}
