import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  isTelanganaStoreReady, previewTelanganaScenario, publishTelanganaScenario,
  telanganaImportHistory, revertToBundled,
} from "@/lib/telangana/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Active import + history (admin only). */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const history = await telanganaImportHistory();
  return Response.json({
    ok: true,
    configured: await isTelanganaStoreReady(),
    active: history.find((h) => h.outcome === "success") ?? null,
    history,
  });
}

/**
 * Telangana scenario import (admin only).
 *   preview (default) → mapped counts + warnings, writes nothing
 *   confirm=1         → parse, insert, then atomically activate
 * A failed commit never replaces the currently active dataset.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;

  let fd: FormData;
  try { fd = await req.formData(); } catch { return Response.json({ ok: false, error: "Expected a multipart upload" }, { status: 400 }); }
  const file = fd.get("file");
  const mode = String(fd.get("mode") ?? "replace") === "append" ? "append" : "replace";
  const confirm = String(fd.get("confirm") ?? "0") === "1";
  if (!(file instanceof File)) return Response.json({ ok: false, error: "No file provided" }, { status: 400 });
  if (!/\.xlsx$/i.test(file.name)) return Response.json({ ok: false, error: "Only .xlsx workbooks are accepted" }, { status: 400 });
  const maxMB = Number(process.env.MAX_UPLOAD_MB || 20);
  if (file.size > maxMB * 1024 * 1024) return Response.json({ ok: false, error: `File exceeds the ${maxMB} MB limit` }, { status: 413 });
  if (!(await isTelanganaStoreReady())) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

  const buf = Buffer.from(await file.arrayBuffer());
  const preview = previewTelanganaScenario(buf);
  if (!confirm) return Response.json({ ok: preview.ok, file: file.name, preview });
  if (!preview.ok) return Response.json({ ok: false, error: "Import blocked — resolve the errors first", preview }, { status: 400 });

  const result = await publishTelanganaScenario({ buffer: buf, filename: file.name, uploader: auth.session.sub, mode });
  return Response.json({ ok: result.outcome === "success", result }, { status: result.outcome === "success" ? 200 : 500 });
}

/** Revert to the bundled baseline (admin only). */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const result = await revertToBundled(auth.session.sub);
  return Response.json({ ok: true, result });
}
