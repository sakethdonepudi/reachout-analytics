import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { surveyWorkbookTemplate } from "@/lib/survey/excel";
import { SURVEY_STATES } from "@/lib/survey/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const state = new URL(req.url).searchParams.get("state") ?? "";
  if (!SURVEY_STATES[state]) {
    return Response.json({ ok: false, error: "Choose Tamil Nadu or Andhra Pradesh." }, { status: 400 });
  }
  const buffer = surveyWorkbookTemplate(state);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reachout-survey-${state}-template.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
