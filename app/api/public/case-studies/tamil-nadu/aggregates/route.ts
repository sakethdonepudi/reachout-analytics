import { NextResponse, type NextRequest } from "next/server";
import { getTamilNaduAggregates } from "@/lib/tamil-nadu/aggregates-server";
import { requireRole } from "@/lib/auth";
import { denyCase } from "@/lib/session-scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "client"]);
  if ("deny" in auth) return auth.deny;
  const denied = await denyCase(auth.session, "tamil-nadu");
  if (denied) return denied;
  // Prefer the last approved snapshot; fall back to the build-verified bundle.
  const bundle = await getTamilNaduAggregates();
  return NextResponse.json(bundle, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-TN-Source-Version": bundle.version,
    },
  });
}
