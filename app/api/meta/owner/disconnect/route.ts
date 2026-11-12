import type { NextRequest } from "next/server";
import { requireRecentAuth } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { isMetaHolder, revokeWorkspaceConnection } from "@/lib/meta/store";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  if (!(await isMetaHolder(auth.session.userId))) return Response.json({ ok: false, error: "Only the Meta account holder can disconnect." }, { status: 403, headers });
  await revokeWorkspaceConnection("disconnect");
  return Response.json({ ok: true });
}
