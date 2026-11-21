import type { NextRequest } from "next/server";
import { requireRecentAuth } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { audit } from "@/lib/audit";
import { validateReasons, validateSegments } from "@/lib/case-data/schema";
import { replaceReasons, replaceSegments } from "@/lib/case-data/store";
import { CASES } from "@/lib/cases";
import type { PollKind } from "@/lib/case-data/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;

  const body = await req.json().catch(() => null) as { dataset?: string; state?: string; rows?: Record<string, unknown>[] } | null;
  if (!body || typeof body.state !== "string" || !Array.isArray(body.rows)) {
    return Response.json({ ok: false, error: "Send a state and rows." }, { status: 400 });
  }
  if (body.rows.length > 5000) {
    return Response.json({ ok: false, error: "Upload at most 5,000 rows at a time." }, { status: 400 });
  }
  const requested = body.state.trim();
  if (!requested) return Response.json({ ok: false, error: "Choose a state." }, { status: 400 });
  const state = CASES.find((item) => item.slug === requested || item.stateName.toLowerCase() === requested.toLowerCase())?.slug ?? requested;

  if (body.dataset === "segments") {
    const parsed = validateSegments(body.rows, state);
    if (parsed.errors.length) return Response.json({ ok: false, error: parsed.errors[0], errors: parsed.errors.slice(0, 20) }, { status: 400 });
    const byType = new Map<PollKind, typeof parsed.rows>();
    for (const row of parsed.rows) {
      const list = byType.get(row.pollType) ?? [];
      list.push(row);
      byType.set(row.pollType, list);
    }
    let count = 0;
    for (const [pollType, rows] of byType) count += await replaceSegments(state, pollType, rows);
    await audit({ action: "dataset_segments_imported", role: "owner", meta: { state, rows: count } });
    return Response.json({ ok: true, rows: count, warnings: parsed.warnings.slice(0, 20) }, { headers: { "Cache-Control": "private, no-store" } });
  }

  if (body.dataset === "reasons") {
    const parsed = validateReasons(body.rows, state);
    if (parsed.errors.length) return Response.json({ ok: false, error: parsed.errors[0], errors: parsed.errors.slice(0, 20) }, { status: 400 });
    const count = await replaceReasons(state, parsed.rows);
    await audit({ action: "dataset_reasons_imported", role: "owner", meta: { state, rows: count } });
    return Response.json({ ok: true, rows: count, warnings: parsed.warnings.slice(0, 20) }, { headers: { "Cache-Control": "private, no-store" } });
  }

  return Response.json({ ok: false, error: "Choose the Segments or Reasons dataset." }, { status: 400 });
}
