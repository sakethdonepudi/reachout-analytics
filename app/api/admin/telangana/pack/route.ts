import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  PACK_FILES, activePack, isPackStoreReady, packHistory, previewPack, publishPack, revertPack,
} from "@/lib/telangana/pack-import";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Pack contract, active activation and history (admin only). */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const [configured, active, history] = await Promise.all([isPackStoreReady(), activePack(), packHistory()]);
  return Response.json({
    ok: true,
    configured,
    expected: PACK_FILES.map((f) => ({ key: f.key, name: f.name, sha256: f.sha256, description: f.description, expected: f.expected })),
    active,
    history,
  });
}

/**
 * Stage / publish the six-workbook pack (admin only).
 *   preview (default) → per-file SHA/count reconciliation, writes nothing
 *   confirm=1         → rehash, insert one record, then atomically activate it
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;

  let fd: FormData;
  try { fd = await req.formData(); } catch { return Response.json({ ok: false, error: "Expected a multipart upload" }, { status: 400 }); }
  const uploaded = [...fd.getAll("files"), ...fd.getAll("file")].filter((f): f is File => f instanceof File);
  const confirm = String(fd.get("confirm") ?? "0") === "1";
  if (!uploaded.length) return Response.json({ ok: false, error: "Attach the six .xlsx workbooks" }, { status: 400 });
  if (uploaded.some((f) => !/\.xlsx$/i.test(f.name))) return Response.json({ ok: false, error: "Only .xlsx workbooks are accepted" }, { status: 400 });
  const maxMB = Number(process.env.MAX_UPLOAD_MB || 20);
  const tooBig = uploaded.find((f) => f.size > maxMB * 1024 * 1024);
  if (tooBig) return Response.json({ ok: false, error: `${tooBig.name} exceeds the ${maxMB} MB limit` }, { status: 413 });

  const files = await Promise.all(uploaded.map(async (f) => ({ name: f.name, buffer: Buffer.from(await f.arrayBuffer()) })));
  const preview = previewPack(files);
  if (!confirm) return Response.json({ ok: preview.ok, preview });
  if (!preview.ok) return Response.json({ ok: false, error: "Pack blocked — resolve the preview issues first", preview }, { status: 400 });
  if (!(await isPackStoreReady())) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

  const result = await publishPack({ files, uploader: auth.session.sub });
  return Response.json({ ok: result.outcome === "success", result, preview }, { status: result.outcome === "success" ? 200 : 500 });
}

/** Deactivate the pack activation and return to the bundled validated snapshot (admin only). */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const result = await revertPack(auth.session.sub);
  return Response.json({ ok: result.ok, result }, { status: result.ok ? 200 : 503 });
}
