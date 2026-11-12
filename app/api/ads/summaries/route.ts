import type { NextRequest } from "next/server";
import { requireRecentAuth } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { audit } from "@/lib/audit";
import { rebuildActiveSummaries } from "@/lib/ads-desk/store";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  const count = await rebuildActiveSummaries();
  await audit({ action: "ads_summaries_rebuilt", role: "owner", meta: { regions: count } });
  return Response.json({ ok: true, regions: count }, { headers });
}
