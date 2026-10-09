import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prepareImportId, insertRowsRaw, finalizeImport, isConfigured } from "@/lib/poll-store";
import type { Row, PollType } from "@/lib/poll-data";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Chunked import, scoped to a case study. Server re-validates each chunk. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  if (!(await isConfigured())) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

  let body: { caseStudyId?: string; pollType?: string; mode?: string; importId?: string; headers?: string[]; rows?: Row[]; final?: boolean; filename?: string; totalInserted?: number } = {};
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const caseStudyId = String(body.caseStudyId ?? "").trim();
  if (!caseStudyId) return Response.json({ ok: false, error: "caseStudyId is required" }, { status: 400 });

  const pollType: PollType = body.pollType === "opinion" ? "opinion" : "exit";
  const mode = body.mode === "replace" ? "replace" : "append";
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const headers = Array.isArray(body.headers) ? body.headers : [];
  const final = !!body.final;
  const filename = String(body.filename ?? "workbook.xlsx");

  // Re-validate the chunk on the server: reject rows without a Response ID and Party key.
  const invalid = rows.filter((r) => !String(r["Response ID"] ?? "").trim() || !("Party" in r));
  if (invalid.length) return Response.json({ ok: false, error: `Chunk rejected: ${invalid.length} row(s) missing Response ID or Party` }, { status: 400 });

  const importId = await prepareImportId(caseStudyId, pollType, mode, typeof body.importId === "string" ? body.importId : undefined);
  const inserted = await insertRowsRaw(caseStudyId, pollType, importId, rows);

  let meta = null;
  if (final) {
    meta = await finalizeImport({ caseStudyId, pollType, importId, mode, filename, uploader: auth.session.sub, headers, inserted: Number(body.totalInserted ?? inserted) });
  }
  return Response.json({ ok: true, importId, inserted, final, meta });
}
