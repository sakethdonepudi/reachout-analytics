import "server-only";

import { CASES, caseBySlug } from "@/lib/cases";
import type { Session } from "@/lib/auth";
import { scopeAllowsCase } from "@/lib/users";
import type { CaseStudy } from "@/lib/cases";

export function caseAllowed(session: Session, slug: string): boolean {
  if (session.role === "owner") return true;
  const record = caseBySlug(slug);
  if (!record) return false;
  return scopeAllowsCase(session.role, session.scope, record);
}

export function scopedCases(session: Session): CaseStudy[] {
  if (session.role === "owner") return CASES;
  return CASES.filter((record) => scopeAllowsCase(session.role, session.scope, record));
}

export function denyCase(session: Session, slug: string): Response | null {
  if (caseAllowed(session, slug)) return null;
  return Response.json({ ok: false, error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
