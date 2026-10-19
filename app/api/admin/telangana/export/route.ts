import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { exportTelanganaScenario } from "@/lib/telangana/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Export the active Telangana scenario (or the bundled baseline) with provenance. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const buf = await exportTelanganaScenario();
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Telangana_scenario_export_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
