import type { NextRequest } from "next/server";
import { requireRecentAuth } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { audit } from "@/lib/audit";
import { deleteConnection, getConnectionDoc } from "@/lib/meta/store";
import { revokeMetaPermissions } from "@/lib/meta/client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  const doc = await getConnectionDoc();
  if (!doc) return Response.json({ ok: true });
  try { await revokeMetaPermissions(); } catch { /* ciphertext is still deleted below */ }
  await deleteConnection();
  await audit({ action: "meta_disconnect", email: auth.session.sub, role: "owner", ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() });
  return Response.json({ ok: true });
}
