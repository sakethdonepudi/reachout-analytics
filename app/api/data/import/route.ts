import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { parseWorkbook, validateSheet, SHEET_OF, type RowIssue } from "@/lib/poll-data";
import { importDataset, isConfigured } from "@/lib/poll-store";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Multipart import (small files). Scoped to a case study. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;

  let fd: FormData;
  try { fd = await req.formData(); } catch { return Response.json({ ok: false, error: "Expected a multipart upload" }, { status: 400 }); }
  const file = fd.get("file");
  const caseStudyId = String(fd.get("caseStudyId") ?? "").trim();
  const mode = String(fd.get("mode") ?? "append") === "replace" ? "replace" : "append";
  const confirm = String(fd.get("confirm") ?? "0") === "1";
  if (!caseStudyId) return Response.json({ ok: false, error: "caseStudyId is required" }, { status: 400 });
  if (!(file instanceof File)) return Response.json({ ok: false, error: "No file provided" }, { status: 400 });
  if (!/\.xlsx$/i.test(file.name)) return Response.json({ ok: false, error: "Only .xlsx workbooks are accepted" }, { status: 400 });
  const maxMB = Number(process.env.MAX_UPLOAD_MB || 20);
  if (file.size > maxMB * 1024 * 1024) return Response.json({ ok: false, error: `File exceeds the ${maxMB} MB limit` }, { status: 413 });
  if (!(await isConfigured())) return Response.json({ ok: false, error: "Database not configured (MONGODB_URI missing)" }, { status: 503 });

  const buf = Buffer.from(await file.arrayBuffer());
  let parsed: ReturnType<typeof parseWorkbook>;
  try { parsed = parseWorkbook(buf); } catch {
    return Response.json({ ok: false, error: "Could not read the workbook — is it a valid .xlsx file?" }, { status: 400 });
  }
  const structural = parsed.errors.filter((e) => e.severity === "error");
  if (structural.length) return Response.json({ ok: false, error: "Workbook structure invalid", errors: structural }, { status: 400 });

  const opinion = validateSheet(SHEET_OF.opinion, parsed.sheets.opinion);
  const exit = validateSheet(SHEET_OF.exit, parsed.sheets.exit);
  const errors: RowIssue[] = [...opinion.issues, ...exit.issues].filter((i) => i.severity === "error");

  if (!confirm) {
    return Response.json({
      ok: true, file: file.name,
      preview: {
        opinion: { total: opinion.total, valid: opinion.valid, blank: opinion.blank, invalid: opinion.invalid, recorded: opinion.recorded, estimated: opinion.estimated },
        exit: { total: exit.total, valid: exit.valid, blank: exit.blank, invalid: exit.invalid, recorded: exit.recorded, estimated: exit.estimated },
        warnings: [...opinion.issues, ...exit.issues].filter((i) => i.severity === "warning").slice(0, 200),
        errors: errors.slice(0, 200),
        canCommit: errors.length === 0,
      },
    });
  }
  if (errors.length) return Response.json({ ok: false, error: "Import blocked: resolve errors first", errors: errors.slice(0, 200) }, { status: 400 });

  const uploader = auth.session.sub;
  const results = [];
  results.push(await importDataset({ caseStudyId, pollType: "opinion", rows: parsed.sheets.opinion, filename: file.name, uploader, mode, headers: parsed.headers.opinion }));
  results.push(await importDataset({ caseStudyId, pollType: "exit", rows: parsed.sheets.exit, filename: file.name, uploader, mode, headers: parsed.headers.exit }));
  const ok = results.every((r) => r.outcome === "success");
  return Response.json({ ok, results }, { status: ok ? 200 : 500 });
}
