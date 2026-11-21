import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { buildDatasetWorkbook, type DatasetKind } from "@/lib/case-data/workbooks";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const dataset = new URL(req.url).searchParams.get("dataset");
  if (dataset !== "segments" && dataset !== "reasons") {
    return Response.json({ ok: false, error: "Choose the segments or reasons template." }, { status: 400 });
  }
  const buffer = buildDatasetWorkbook(dataset as DatasetKind);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reachout-${dataset}-template.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
