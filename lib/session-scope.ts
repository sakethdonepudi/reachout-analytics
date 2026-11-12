import "server-only";

import { CASES, type CaseStudy } from "@/lib/cases";
import { listCases } from "@/lib/case-registry";
import type { Session } from "@/lib/auth";
import { canOpenCase } from "@/lib/access";

/** Published case slugs. Owners see every case; clients only published ones. */
async function publishedSlugs(): Promise<Set<string>> {
  const registry = await listCases().catch(() => []);
  return new Set(registry.filter((row) => row.published).map((row) => row.slug));
}

export async function caseAllowed(session: Session, slug: string): Promise<boolean> {
  return canOpenCase(session.role, (await publishedSlugs()).has(slug));
}

export async function visibleCases(session: Session): Promise<CaseStudy[]> {
  if (session.role === "owner") return CASES;
  const published = await publishedSlugs();
  return CASES.filter((record) => published.has(record.slug));
}

export async function denyCase(session: Session, slug: string): Promise<Response | null> {
  if (await caseAllowed(session, slug)) return null;
  return Response.json({ ok: false, error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
