import type { NextRequest } from "next/server";
import aggregates from "@/lib/data/tamil-nadu/aggregates.json";
import type { TnAggregates } from "@/lib/tamil-nadu/model";
import { requireAdmin } from "@/lib/auth";
import { getPublishedAllocation, publishAllocation } from "@/lib/tamil-nadu/allocation-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function preview(bundle: TnAggregates, published: Awaited<ReturnType<typeof getPublishedAllocation>>) {
  return {
    bundleVersion: bundle.version,
    allocationVersion: bundle.allocation.version,
    method: bundle.allocation.method,
    sourceImportId: bundle.allocation.sourceImportId,
    sourceHash: bundle.sourceHash,
    priority: bundle.allocation.priority,
    recorded: bundle.allocation.recorded,
    allocated: bundle.allocation.allocated,
    combined: bundle.allocation.combined,
    reconcile: bundle.allocation.reconcile,
    workbook: bundle.allocation.workbook,
    districts: bundle.districts.map((d) => ({
      name: d.name,
      acs: d.acs.length,
      recorded: d.recorded,
      allocatedDistrictOnly: d.allocatedDistrictOnly,
      allocatedUnlocated: d.allocatedUnlocated,
      combined: d.combined,
      projectedSeats: d.projectedSeats,
    })),
    published: published ? {
      publishedAt: published.publishedAt,
      allocationVersion: published.allocationVersion,
      sourceImportId: published.sourceImportId,
      sourceHash: published.sourceHash,
      matchesCurrent: published.sourceHash === bundle.sourceHash && published.allocationVersion === bundle.allocation.version,
    } : null,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const bundle = aggregates as TnAggregates;
  const published = await getPublishedAllocation();
  return Response.json({ ok: true, preview: preview(bundle, published) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  let body: { confirm?: boolean } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  if (!body.confirm) return Response.json({ ok: false, error: "Confirm the allocation before publishing." }, { status: 400 });
  const bundle = aggregates as TnAggregates;
  const r = bundle.allocation.reconcile;
  if (!r.partyTotalsUnchanged || !r.acDistrictEqual || !r.districtStateEqual || !r.noDoubleCount || r.combinedAssembly !== 31_316) {
    return Response.json({ ok: false, error: "Allocation reconciliation failed; publish blocked." }, { status: 400 });
  }
  const published = await publishAllocation(bundle);
  if (!published) return Response.json({ ok: false, error: "Database not configured or publish failed." }, { status: 503 });
  return Response.json({ ok: true, preview: preview(bundle, published) }, { headers: { "Cache-Control": "no-store" } });
}
