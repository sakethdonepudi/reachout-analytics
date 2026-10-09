import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { summary, partyShares, isConfigured } from "@/lib/poll-store";

export const runtime = "nodejs";

/** Compact dashboard summary for both datasets. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  if (!(await isConfigured())) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

  const scenario = new URL(req.url).searchParams.get("view") === "scenario";
  const [opinion, exit] = await Promise.all([summary("opinion"), summary("exit")]);
  const [opinionShares, exitShares] = await Promise.all([partyShares("opinion", scenario), partyShares("exit", scenario)]);
  return Response.json({ ok: true, view: scenario ? "scenario" : "recorded", opinion, exit, opinionShares, exitShares });
}
