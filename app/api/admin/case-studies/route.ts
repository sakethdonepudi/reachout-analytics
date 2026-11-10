import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";
import { requireCsrf } from "@/lib/csrf";
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
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const parsed = z.object({ id: z.string().min(1).max(80), patch: z.record(z.string(), z.unknown()).default({}) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });
  const id = parsed.data.id;
  const allowed = ["title", "description", "published", "electionYear", "state"] as const;
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in parsed.data.patch) patch[k] = parsed.data.patch[k];
  const updated = await updateCase(id, patch as never);
  if (!updated) return Response.json({ ok: false, error: "Case study not found" }, { status: 404 });
  return Response.json({ ok: true, case: updated });
}
