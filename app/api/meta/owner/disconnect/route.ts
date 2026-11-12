import type { NextRequest } from "next/server";
import { requireRecentAuth } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { cleanupSessionConnection } from "@/lib/meta/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  await cleanupSessionConnection(auth.session.sid, "logout");
  return Response.json({ ok: true });
}
