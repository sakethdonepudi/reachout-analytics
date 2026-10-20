import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { DATA } from "@/lib/telangana/oct26";
import {
  isOct26StoreReady, oct26ActiveImport, oct26ImportHistory,
  previewOct26Workbook, publishOct26, revertOct26,
} from "@/lib/telangana/oct26-import";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Active import + history for the October workbook contract (admin only). */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const [configured, active, history] = await Promise.all([
    isOct26StoreReady(), oct26ActiveImport(), oct26ImportHistory(),
  ]);
  return Response.json({
    ok: true,
    configured,
    contract: {
      version: DATA.version,
      sourceFile: DATA.sourceFile,
      sourceHash: DATA.sourceHash,
      cutoff: DATA.cutoff,
      shrinkFactor: DATA.shrinkFactor,
      overrideVersion: DATA.overrideVersion,
      devicesAvailable: DATA.devicesAvailable,
      pinDataAvailable: DATA.pinDataAvailable,
      counts: DATA.counts,
      parties: DATA.parties,
    },
    active,
    history,
  });
}

/**
 * Stage / publish the October workbook (admin only).
 *   preview (default) → header + count reconciliation, writes nothing
 *   confirm=1         → re-check the hash, insert the record, then atomically activate
 * The validated projection aggregates are bound to the contract SHA-256;
 * this route never evaluates workbook formulas.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;

  let fd: FormData;
  try { fd = await req.formData(); } catch { return Response.json({ ok: false, error: "Expected a multipart upload" }, { status: 400 }); }
  const file = fd.get("file");
  const confirm = String(fd.get("confirm") ?? "0") === "1";
  if (!(file instanceof File)) return Response.json({ ok: false, error: "No file provided" }, { status: 400 });
  if (!/\.xlsx$/i.test(file.name)) return Response.json({ ok: false, error: "Only .xlsx workbooks are accepted" }, { status: 400 });
  const maxMB = Number(process.env.MAX_UPLOAD_MB || 20);
  if (file.size > maxMB * 1024 * 1024) return Response.json({ ok: false, error: `File exceeds the ${maxMB} MB limit` }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const preview = previewOct26Workbook(buf);
  if (!confirm) return Response.json({ ok: preview.ok, file: file.name, preview });
  if (!preview.ok) return Response.json({ ok: false, error: "Import blocked — preview must pass first", preview }, { status: 400 });
  if (!(await isOct26StoreReady())) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

  const result = await publishOct26({ buffer: buf, filename: file.name, uploader: auth.session.sub });
  return Response.json({ ok: result.outcome === "success", result, preview }, { status: result.outcome === "success" ? 200 : 500 });
}

/** Revert to the bundled validated snapshot (admin only). */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const result = await revertOct26(auth.session.sub);
  return Response.json({ ok: result.ok, result }, { status: result.ok ? 200 : 503 });
}
