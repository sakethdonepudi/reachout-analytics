import { NextResponse } from "next/server";
import { loadTelanganaAggregates } from "@/lib/telangana/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public Telangana aggregates.
 *
 * Returns aggregates only — never raw response rows, IPs, IDs, user agents or
 * journeys. The payload carries the basis, import version and denominator
 * definitions so every map fill and chart is derived from the same scope.
 */
export async function GET() {
  const data = await loadTelanganaAggregates();
  return NextResponse.json(
    {
      published: true,
      caseStudy: data.caseStudy,
      pollType: data.pollType,
      basis: data.basis,
      importVersion: data.importVersion,
      importAt: data.importAt,
      historicalSourceVersion: data.historicalSourceVersion,
      originalEntrySource: data.originalEntrySource,
      scope: "state",
      denominatorDefinition: data.denominatorDefinition,
      surveyCollectionYear: data.surveyCollectionYear,
      surveyQuestionYear: data.surveyQuestionYear,
      historicalPeriods: data.historicalPeriods,
      version: data.version,
      generatedAt: data.generatedAt,
      totals: data.totals,
      partyOrder: data.partyOrder,
      statewide: data.statewide,
      districts: data.districts,
      acs: data.acs,
      age: data.age,
      brands: data.brands,
      rounds: data.rounds,
      daily: data.daily,
      crosswalk: data.crosswalk,
    },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } },
  );
}
