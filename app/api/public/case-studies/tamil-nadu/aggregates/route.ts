import { NextResponse } from "next/server";
import aggregates from "@/lib/data/tamil-nadu/aggregates.json";
import type { TnAggregates } from "@/lib/tamil-nadu/model";
import { getPublishedSnapshot } from "@/lib/tamil-nadu/snapshot-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // Prefer the last approved snapshot; fall back to the build-verified bundle.
  const published = await getPublishedSnapshot();
  const current = aggregates as TnAggregates;
  const matches = !!published && published.sourceHash === current.sourceHash && published.sourceVersion === current.version;
  const bundle = (matches ? published!.bundle : current) as TnAggregates;
  return NextResponse.json(bundle, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-TN-Data-Source": matches ? "published" : "bundled",
      "X-TN-Source-Version": bundle.version,
    },
  });
}
