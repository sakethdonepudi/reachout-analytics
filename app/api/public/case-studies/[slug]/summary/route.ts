import type { NextRequest } from "next/server";
import { getCase } from "@/lib/case-registry";
import { summary, partyShares, isConfigured } from "@/lib/poll-store";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Public aggregate statistics for a PUBLISHED case study.
 * Returns counts + party shares only — never raw records or downloads.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const { slug } = await params;
  try {
    const record = await getCase(slug);
    if (!record) return Response.json({ ok: false, error: "Unknown case study" }, { status: 404 });
    if (!record.published) return Response.json({ ok: true, published: false, caseStudyId: record.id });
    if (!(await isConfigured())) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

    const [opinion, exit] = await Promise.all([summary(record.id, "opinion"), summary(record.id, "exit")]);
    const [opinionShares, exitShares] = await Promise.all([partyShares(record.id, "opinion"), partyShares(record.id, "exit")]);
    return Response.json({
      ok: true, published: true, caseStudyId: record.id,
      opinion: { counts: opinion?.counts ?? null, shares: opinionShares, asOf: opinion?.asOf ?? null },
      exit: { counts: exit?.counts ?? null, shares: exitShares, asOf: exit?.asOf ?? null },
      asOf: exit?.asOf ?? opinion?.asOf ?? null,
    });
  } catch {
    return Response.json({ ok: false, error: "Opinion poll data unavailable" }, { status: 503 });
  }
}
