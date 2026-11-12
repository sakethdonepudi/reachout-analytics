import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireRecentAuth } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { audit } from "@/lib/audit";
import { publishVersion } from "@/lib/ads-desk/store";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req); if (csrf) return csrf;
  const auth = await requireRecentAuth(req); if ("deny" in auth) return auth.deny;
  const parsed = z.object({ versionId: z.string().min(1).max(80) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid request" }, { status: 400, headers });
  try { await publishVersion(parsed.data.versionId); } catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : "Could not roll back." }, { status: 400, headers }); }
  await audit({ action: "ads_rollback", role: "owner", meta: { versionId: parsed.data.versionId } });
  return Response.json({ ok: true }, { headers });
}
