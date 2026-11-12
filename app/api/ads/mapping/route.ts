import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireRecentAuth, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { audit } from "@/lib/audit";
import { getRegionMap, setRegionMapping } from "@/lib/ads-desk/mapping";
import { getActiveVersion } from "@/lib/ads-desk/store";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner"]); if ("deny" in auth) return auth.deny;
  const [map, active] = await Promise.all([getRegionMap(), getActiveVersion()]);
  return Response.json({ ok: true, mapping: map, regionKeys: active?.data.regionKeys ?? Object.keys(map) }, { headers });
}

export async function PUT(req: NextRequest) {
  const csrf = requireCsrf(req); if (csrf) return csrf;
  const auth = await requireRecentAuth(req); if ("deny" in auth) return auth.deny;
  const parsed = z.object({ regionKey: z.string().min(1).max(40), caseSlug: z.string().max(80).nullable() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid request" }, { status: 400, headers });
  const result = await setRegionMapping(parsed.data.regionKey, parsed.data.caseSlug, auth.session.displayName ?? "owner");
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 400, headers });
  await audit({ action: "ads_publish", role: "owner", meta: { mapping: parsed.data.regionKey, caseSlug: parsed.data.caseSlug } });
  return Response.json({ ok: true }, { headers });
}
