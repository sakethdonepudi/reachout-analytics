import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { getMetaStatus } from "@/lib/meta/store";
import { publicClientSummary } from "@/lib/meta/public";

export const runtime = "nodejs";

/** Client-safe connection summary. No cost, spend, budget or token fields. */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "client"]);
  if ("deny" in auth) return auth.deny;
  return Response.json({ ok: true, summary: publicClientSummary(await getMetaStatus()) }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
