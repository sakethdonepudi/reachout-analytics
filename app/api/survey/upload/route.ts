import type { NextRequest } from "next/server";
import { requireRecentAuth } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { audit } from "@/lib/audit";
import { parseSurveyHtml } from "@/lib/survey/parse";
import { parseSurveyWorkbook } from "@/lib/survey/excel";
import { publishSurvey } from "@/lib/survey/store";
import { SURVEY_STATES, type SurveyData } from "@/lib/survey/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const state = String(form?.get("state") ?? "");
  const confirm = String(form?.get("confirm") ?? "") === "1";
  if (!(file instanceof File)) return Response.json({ ok: false, error: "Choose a survey dashboard HTML or Excel file." }, { status: 400 });
  if (!SURVEY_STATES[state]) return Response.json({ ok: false, error: "Choose Tamil Nadu or Andhra Pradesh." }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return Response.json({ ok: false, error: "That file is larger than 4 MB." }, { status: 400 });

  try {
    let data: SurveyData;
    if (/\.xlsx?$/i.test(file.name)) {
      data = parseSurveyWorkbook(Buffer.from(await file.arrayBuffer()), state);
    } else if (/\.html?$/i.test(file.name)) {
      data = parseSurveyHtml(await file.text(), state);
    } else {
      return Response.json({ ok: false, error: "Choose the survey dashboard .html or .xlsx file." }, { status: 400 });
    }
    const preview = {
      periods: Object.entries(data.periods).map(([key, period]) => ({ key, label: period.label, n: period.n, from: period.from, to: period.to })),
      n_total: data.n_total,
      state,
      stateName: SURVEY_STATES[state].name,
      source: /\.xlsx?$/i.test(file.name) ? "excel" : "html",
    };
    if (!confirm) return Response.json({ ok: true, preview }, { headers: { "Cache-Control": "private, no-store" } });
    const version = await publishSurvey(state, file.name, data);
    await audit({ action: "survey_published", role: "owner", meta: { state, version, periods: preview.periods.length, source: preview.source } });
    return Response.json({ ok: true, preview, version }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "That survey dashboard could not be parsed." }, { status: 400 });
  }
}
