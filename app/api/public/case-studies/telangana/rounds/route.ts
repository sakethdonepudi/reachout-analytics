import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import rounds from "@/lib/data/telangana/rounds.json";

export const runtime = "nodejs";

type Scope = {
  name: string;
  eligible: number;
  dateMin: string | null;
  dateMax: string | null;
  rounds388: unknown[];
  rounds688: unknown[];
  daily: unknown[];
  blocks50: unknown[];
};

const SCOPES = rounds.scopes as unknown as Record<string, Scope>;

/**
 * Aggregate survey periods for the expanded analysis.
 *
 * 388/688 rounds, calendar-day groups and deterministic 50-response blocks
 * computed from the source records; no Entry IDs or raw rows are exposed.
 */
export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope") ?? "state";
  if (!/^(state|d:[^/]+|a:\d+)$/.test(scope)) {
    return NextResponse.json({ error: "Unknown scope" }, { status: 400 });
  }
  const data = SCOPES[scope];
  if (!data) return NextResponse.json({ error: "Scope not found" }, { status: 404 });
  return NextResponse.json(
    {
      version: rounds.version,
      source: rounds.source,
      parties: rounds.parties,
      modelAssumptions: rounds.modelAssumptions,
      roundBasis: rounds.roundBasis,
      scope,
      ...data,
      globalEntries: rounds.entries,
      globalDateMin: rounds.dateMin,
      globalDateMax: rounds.dateMax,
    },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } },
  );
}
