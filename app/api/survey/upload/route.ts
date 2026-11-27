import type { NextRequest } from "next/server";
import { requireRecentAuth } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { audit } from "@/lib/audit";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseSurveyUpload } from "@/lib/survey/parse";
import { publishSurvey } from "@/lib/survey/store";
import { SURVEY_STATES, type SurveyData } from "@/lib/survey/types";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

function previewFor(data: SurveyData, state: string) {
  const periods = Object.entries(data.periods).map(([key, period]) => ({
    key,
    label: period.label,
    n: period.n,
    from: period.from ?? "",
    to: period.to ?? "",
    months: Object.values(period.months ?? {}).map((month) => ({ label: month.label, n: month.n })),
  }));
  const ads = data.ads as Record<string, unknown> | undefined;
  const total = (ads?.total ?? {}) as Record<string, unknown>;
  const accounts = Array.isArray(ads?.accounts) ? ads.accounts.length : 0;
  const first = periods.find((period) => period.from)?.from ?? "";
  const last = [...periods].reverse().find((period) => period.to)?.to ?? "";
  return {
    periods,
    n_total: data.n_total,
    state,
    stateName: SURVEY_STATES[state].name,
    source: "html",
    range: typeof ads?.range === "string" && ads.range ? ads.range : [first, last].filter(Boolean).join(" to "),
    ads: {
      campaigns: Number(total.n ?? 0),
      accounts,
      reach: Number(total.reach ?? 0),
      engagements: Number(total.eng ?? 0),
      range: typeof ads?.range === "string" ? ads.range : "",
      label: typeof ads?.label === "string" ? ads.label : "",
    },
  };
}

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const limit = rateLimit(`survey-upload:${ip}`, 20, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const state = String(form?.get("state") ?? "");
  const confirm = String(form?.get("confirm") ?? "") === "1";
  if (!(file instanceof File)) return Response.json({ ok: false, error: "Choose a dashboard HTML file." }, { status: 400, headers });
  if (!SURVEY_STATES[state]) return Response.json({ ok: false, error: "Choose Tamil Nadu or Andhra Pradesh." }, { status: 400, headers });
  if (!/\.html$/i.test(file.name)) return Response.json({ ok: false, error: "Only .html dashboard files are accepted." }, { status: 400, headers });
  if (file.size > 15 * 1024 * 1024) return Response.json({ ok: false, error: "That file is larger than 15 MB." }, { status: 400, headers });

  try {
    const data = parseSurveyUpload(await file.text(), state);
    const preview = previewFor(data, state);
    if (!confirm) return Response.json({ ok: true, preview }, { headers });
    const uploadedBy = auth.session.displayName ?? auth.session.userId ?? "Owner";
    const version = await publishSurvey(state, file.name, data, uploadedBy);
    await audit({ action: "survey_published", role: "owner", meta: { state, version, periods: preview.periods.length, campaigns: preview.ads.campaigns, source: preview.source } });
    return Response.json({ ok: true, preview, version }, { headers });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "That dashboard could not be parsed." }, { status: 400, headers });
  }
}
