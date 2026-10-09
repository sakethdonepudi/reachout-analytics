import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listCases, updateCase } from "@/lib/case-registry";
import { migrateLegacyToCase } from "@/lib/poll-store";

export const runtime = "nodejs";

/** List the case-study registry (and run the one-time legacy scoping migration). */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  await migrateLegacyToCase("tamil-nadu");
  const cases = await listCases();
  return Response.json({ ok: true, cases });
}

/** Update a case study's title / description / publication status. */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  let body: { id?: string; patch?: Record<string, unknown> } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const id = String(body.id ?? "").trim();
  if (!id) return Response.json({ ok: false, error: "id is required" }, { status: 400 });
  const allowed = ["title", "description", "published", "electionYear", "state"] as const;
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (body.patch && k in body.patch) patch[k] = body.patch[k];
  const updated = await updateCase(id, patch as never);
  if (!updated) return Response.json({ ok: false, error: "Case study not found" }, { status: 404 });
  return Response.json({ ok: true, case: updated });
}
