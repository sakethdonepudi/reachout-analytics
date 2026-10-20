import { NextResponse } from "next/server";
import { DATA } from "@/lib/telangana/oct26";
import { oct26ActiveImport } from "@/lib/telangana/oct26-import";

export const runtime = "nodejs";

/** Never let a slow/absent database delay the public snapshot. */
async function activeImportSafe() {
  try {
    return await Promise.race([
      oct26ActiveImport(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
    ]);
  } catch {
    return null;
  }
}

/**
 * Public Telangana aggregates for the October workbook (tg-oct20-v1).
 *
 * Aggregates only: per-AC and per-district shares plus the statewide rollup.
 * No Entry IDs, raw rows, device data or PINs are exposed. The dataset is the
 * packaged validated snapshot for this workbook hash; the workbook itself
 * stays in private admin storage.
 */
export async function GET() {
  const active = await activeImportSafe();
  return NextResponse.json(
    {
      published: true,
      caseStudy: "telangana",
      pollType: "opinion",
      basis: "tg-oct20-v1",
      activeImport: active
        ? { importId: active.importId, version: active.version, sourceHash: active.sourceHash, at: active.at, filename: active.filename }
        : null,
      sourceFile: DATA.sourceFile,
      sourceHash: DATA.sourceHash,
      cutoff: DATA.cutoff,
      shrinkFactor: DATA.shrinkFactor,
      version: DATA.version,
      overrideVersion: DATA.overrideVersion,
      devicesAvailable: DATA.devicesAvailable,
      pinDataAvailable: DATA.pinDataAvailable,
      parties: DATA.parties,
      labels: DATA.labels,
      congressBasis: DATA.congressBasis,
      othersBasis: DATA.othersBasis,
      counts: DATA.counts,
      statewide: DATA.statewide,
      districts: DATA.districts,
      acs: DATA.acs,
      overrides: DATA.overrides,
      overrideMeta: DATA.overrideMeta,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
