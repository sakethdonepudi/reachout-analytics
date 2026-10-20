import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { exportOct26Provenance } from "@/lib/telangana/oct26-import";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Export the active validated snapshot with provenance (aggregates only). */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const body = JSON.stringify(exportOct26Provenance(), null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="Telangana_tg-oct20-v1_provenance_${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
