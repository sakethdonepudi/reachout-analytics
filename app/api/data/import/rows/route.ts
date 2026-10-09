import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prepareImportId, insertRowsRaw, finalizeImport, ensureIndexes, isConfigured } from "@/lib/poll-store";
import type { Row, PollType } from "@/lib/poll-data";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Chunked import. The browser parses the workbook and posts small batches so
 * large files stay under platform request-size limits. Rows are inserted under
 * an importId; the active pointer is flipped only on the final chunk (replace),
 * keeping replacement atomic.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  if (!(await isConfigured())) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

  let body: { pollType?: string; mode?: string; importId?: string; headers?: string[]; rows?: Row[]; final?: boolean; filename?: string; totalInserted?: number } = {};
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const pollType: PollType = body.pollType === "opinion" ? "opinion" : "exit";
  const mode = body.mode === "replace" ? "replace" : "append";
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const headers = Array.isArray(body.headers) ? body.headers : [];
  const final = !!body.final;
  const filename = String(body.filename ?? "workbook.xlsx");

  await ensureIndexes();
  const importId = await prepareImportId(pollType, mode, typeof body.importId === "string" ? body.importId : undefined);
  const inserted = await insertRowsRaw(pollType, importId, rows);

  let meta = null;
  if (final) {
    meta = await finalizeImport({
      pollType, importId, mode, filename,
      uploader: auth.session.sub, headers,
      inserted: Number(body.totalInserted ?? inserted),
    });
  }
  return Response.json({ ok: true, importId, inserted, final, meta });
}
