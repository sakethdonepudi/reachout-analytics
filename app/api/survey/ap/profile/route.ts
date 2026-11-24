import type { NextRequest } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/auth";
import { getSurveyCached } from "@/lib/survey/store";
import { buildApSurveyMap } from "@/lib/andhra-pradesh/survey-map";

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
  if ((params.get("state") ?? "andhra-pradesh-2024") !== "andhra-pradesh-2024") return Response.json({ ok: false, error: "Only Andhra Pradesh is available." }, { status: 400, headers });
  const period = params.get("period") === "ex" ? "ex" : params.get("period") === "rd" ? "rd" : "op";
  const slot = params.get("slot") ?? "all";
  const profileKey = params.get("profile") ?? "ac";
  const record = await getSurveyCached("andhra-pradesh-2024");
  if (!record) return Response.json({ ok: false, error: "Survey dashboard not uploaded." }, { status: 404, headers });
  try {
    const resolved = buildApSurveyMap(record.data, period, slot).slot;
    const demo = resolved.demo[profileKey];
    if (!demo) return Response.json({ ok: false, error: "That profile does not exist in this slot." }, { status: 404, headers });
    return Response.json({ ok: true, demo, catalog: Object.fromEntries(Object.entries(resolved.demo).map(([key, value]) => [key, { label: value.label, cov: value.cov }])) }, { headers });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "That survey slot does not exist." }, { status: 404, headers });
  }
}
