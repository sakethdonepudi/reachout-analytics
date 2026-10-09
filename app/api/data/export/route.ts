import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { buildWorkbook, type Row } from "@/lib/poll-data";
import { getActiveImportId } from "@/lib/poll-store";
import { getMongo } from "@/lib/mongodb";

export const runtime = "nodejs";
export const maxDuration = 60;

const DB = process.env.MONGODB_DB || "reachout";

async function allRows(pollType: "opinion" | "exit"): Promise<Row[]> {
  const p = getMongo();
  if (!p) return [];
  const importId = await getActiveImportId(pollType);
  if (!importId) return [];
  const client = await p;
  const cursor = client.db(DB).collection("poll_responses").find({ pollType, importId }).project({ _id: 0, row: 1 });
  const out: Row[] = [];
  for await (const d of cursor) out.push((d as { row: Row }).row);
  return out;
}

/** Export the full dataset (both sheets) as one .xlsx. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  if (!getMongo()) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

  const [opinion, exit] = await Promise.all([allRows("opinion"), allRows("exit")]);
  const buf = buildWorkbook(opinion, exit);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reachout-poll-export-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
