import { NextResponse } from "next/server";
import aggregates from "@/lib/data/tamil-nadu/aggregates.json";
import type { TnAggregates } from "@/lib/tamil-nadu/model";
import { getPublishedAllocation } from "@/lib/tamil-nadu/allocation-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // The admin publish workflow stores the last approved aggregate bundle. If
  // storage is unavailable, the bundled, build-verified snapshot remains the
  // safe fallback. Never cache this route: a publish must be visible on reload.
  const published = await getPublishedAllocation();
  const current = aggregates as TnAggregates;
  const bundle = (published && published.sourceHash === current.sourceHash && published.allocationVersion === current.allocation.version
    ? published.bundle
    : current) as TnAggregates;
  return NextResponse.json(bundle, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
