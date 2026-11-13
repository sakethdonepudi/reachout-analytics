import "server-only";

import { CASES, type CaseStudy } from "@/lib/cases";
import type { Session } from "@/lib/auth";

/** Every named case study is visible to owners and clients. */
export async function caseAllowed(_session: Session, slug: string): Promise<boolean> {
  return CASES.some((record) => record.slug === slug);
}

export async function visibleCases(_session: Session): Promise<CaseStudy[]> {
  return CASES;
}

export async function denyCase(session: Session, slug: string): Promise<Response | null> {
  if (await caseAllowed(session, slug)) return null;
  return Response.json({ ok: false, error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
