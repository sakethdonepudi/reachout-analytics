import type { NextRequest } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/auth";
import { getSurveyCached } from "@/lib/survey/store";
import { serializeMap } from "@/lib/survey/tn-view-dto";
import { buildSurveyMap } from "@/lib/tamil-nadu/survey-map";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

const headers = { "Cache-Control": "private, max-age=300", Vary: "Cookie" };

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    const response = Response.json({ ok: false, error: "Sign in required" }, { status: 401, headers });
    clearSessionCookie(response);
    return response;
  }
  const params = new URL(req.url).searchParams;
  const state = params.get("state") ?? "tamil-nadu";
  if (state !== "tamil-nadu") return Response.json({ ok: false, error: "Only Tamil Nadu is available." }, { status: 400, headers });
  const period = params.get("period") === "ex" ? "ex" : "op";
  const slot = params.get("slot") ?? "all";
  const record = await getSurveyCached("tamil-nadu");
  if (!record) return Response.json({ ok: false, error: "Survey dashboard not uploaded." }, { status: 404, headers });
  try {
    return Response.json({ ok: true, map: serializeMap(buildSurveyMap(record.data, period, slot)) }, { headers });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "The map could not be built." }, { status: 500, headers });
  }
}
