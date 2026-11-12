import type { NextRequest } from "next/server";
import { requireRole, sessionIsRecent } from "@/lib/auth";
import { metaConfigured } from "@/lib/meta/oauth";
import { getMetaStatus } from "@/lib/meta/store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner"]);
  if ("deny" in auth) return auth.deny;
  return Response.json(
    { ok: true, metaConfigured: metaConfigured(), status: await getMetaStatus(auth.session.userId), recent: sessionIsRecent(auth.session) },
    { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
  );
}
