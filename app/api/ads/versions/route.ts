import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { listVersions } from "@/lib/ads-desk/store";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner"]); if ("deny" in auth) return auth.deny;
  return Response.json({ ok: true, versions: await listVersions() }, { headers });
}
