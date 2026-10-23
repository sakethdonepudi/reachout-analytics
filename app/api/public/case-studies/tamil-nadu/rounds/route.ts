import { NextRequest, NextResponse } from "next/server";
import bundle from "@/lib/data/tamil-nadu/rounds.json";

const SCOPES = (bundle as { scopes: Record<string, unknown> }).scopes;

export const dynamic = "force-static";

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope") ?? "state";
  const data = SCOPES[scope] as undefined | {
    name: string; entries: number; dateMin: string; dateMax: string;
    rounds388: unknown[]; rounds688: unknown[]; daily: unknown[]; blocks50: unknown[];
  };
  if (!data) return NextResponse.json({ error: "Scope not found" }, { status: 404 });
  return NextResponse.json({
    version: bundle.version, parties: bundle.parties, entries: bundle.entries,
    dateMin: bundle.dateMin, dateMax: bundle.dateMax, roundPolicy: bundle.roundPolicy, model: bundle.model,
    scope, name: data.name, scopeEntries: data.entries, scopeDateMin: data.dateMin, scopeDateMax: data.dateMax,
    rounds388: data.rounds388, rounds688: data.rounds688, daily: data.daily, blocks50: data.blocks50,
  }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } });
}
