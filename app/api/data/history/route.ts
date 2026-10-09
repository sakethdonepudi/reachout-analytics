import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { history } from "@/lib/poll-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const rows = await history(25);
  return Response.json({ ok: true, history: rows });
}
