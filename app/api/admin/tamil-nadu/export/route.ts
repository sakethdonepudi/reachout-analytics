import type { NextRequest } from "next/server";
import { utils, write } from "xlsx";
import aggregates from "@/lib/data/tamil-nadu/aggregates.json";
import type { TnAggregates } from "@/lib/tamil-nadu/model";
import { requireAdmin } from "@/lib/auth";
import { getPublishedSnapshot } from "@/lib/tamil-nadu/snapshot-store";

export const runtime = "nodejs";
export const maxDuration = 60;
const pct = (v: number | undefined) => (v == null ? "" : Math.round(v * 10000) / 100);

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const published = await getPublishedSnapshot();
  const bundle = (published?.bundle ?? aggregates) as TnAggregates;
  const format = req.nextUrl.searchParams.get("format") === "json" ? "json" : "xlsx";
  if (format === "json") {
    return new Response(JSON.stringify({ publishedAt: published?.publishedAt ?? null, ...bundle }, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="Tamil_Nadu_final_aggregates_${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" },
    });
  }
  const wb = utils.book_new();
  const summaryRows = [
    ["Item", "Value"],
    ["Source version", bundle.version], ["Source import ID", bundle.sourceImportId], ["Source file", bundle.sourceFile], ["Source SHA-256", bundle.sourceHash],
    ["Total party-choice responses", bundle.source.totalResponses], ["With AC", bundle.source.withAc], ["NO DIST, AC", bundle.source.noAc],
    ["Constituencies", bundle.source.constituencies], ["Districts", bundle.source.districts], ["Published at", published?.publishedAt ?? "not published"],
    ["Survey TVK %", pct(bundle.statewide.survey.shares?.TVK)], ["Calibrated TVK %", pct(bundle.statewide.calibrated.shares.TVK)], ["Actual TVK %", pct(bundle.statewide.actualVoteShares.shares.TVK)],
    ["Original seats TVK/AIADMK+/DMK+", JSON.stringify(bundle.statewide.originalSeats)], ["Final calibrated seats", JSON.stringify(bundle.statewide.finalSeats)], ["Actual seats", JSON.stringify(bundle.statewide.actualSeats)],
    ["Original calls correct", bundle.metrics.originalCorrect], ["Survey leaders correct", bundle.metrics.surveyLeaderCorrect], ["Model fitted correct", bundle.metrics.modelCorrect], ["Model CV correct", bundle.metrics.modelCvCorrect], ["Final calibrated correct", bundle.metrics.finalCorrect], ["Final CV with imposed district totals", bundle.metrics.finalCvCorrect],
  ];
  utils.book_append_sheet(wb, utils.json_to_sheet(summaryRows), "Summary");
  const acRows = bundle.acs.map((a) => ({
    "AC No": a.no, AC: a.name, District: a.district, "Survey n": a.survey.valid,
    "TVK votes": a.survey.counts.TVK, "AIADMK+ votes": a.survey.counts["AIADMK+BJP+PMK+AMMK"], "DMK+ votes": a.survey.counts["DMK+INC+VCK"], "NTK votes": a.survey.counts.NTK, "NOTA votes": a.survey.counts.NOTA,
    "TVK %": pct(a.survey.shares?.TVK), "AIADMK+ %": pct(a.survey.shares?.["AIADMK+BJP+PMK+AMMK"]), "DMK+ %": pct(a.survey.shares?.["DMK+INC+VCK"]), "NTK %": pct(a.survey.shares?.NTK), "NOTA %": pct(a.survey.shares?.NOTA),
    "Saket call": a.original.leader ?? "", "Saket match": a.original.correct,
    "Model call": a.model.leader ?? "", "Model P(win)": a.model.probability, "Model match": a.model.correct,
    "Final calibrated call": a.final.leader ?? "", "Final P(win)": a.final.probability, "Final match": a.final.correct,
    "Actual 2026 winner": a.actual2026.winner ?? "", "Actual party": a.actual2026.party,
  }));
  utils.book_append_sheet(wb, utils.json_to_sheet(acRows), "AC estimates");
  const districtRows = bundle.districts.map((d) => ({
    District: d.name, ACs: d.acs.length, "Survey n": d.survey.valid,
    "TVK votes": d.survey.counts.TVK, "AIADMK+ votes": d.survey.counts["AIADMK+BJP+PMK+AMMK"], "DMK+ votes": d.survey.counts["DMK+INC+VCK"], "NTK votes": d.survey.counts.NTK, "NOTA votes": d.survey.counts.NOTA,
    "Survey leader": d.surveyLeader ?? "", "Original seats": JSON.stringify(d.originalSeats), "Final seats": JSON.stringify(d.finalSeats), "Actual seats": JSON.stringify(d.actualSeats),
  }));
  utils.book_append_sheet(wb, utils.json_to_sheet(districtRows), "District estimates");
  const histRows = [];
  for (const y of bundle.years) for (const a of bundle.acs) { const h = a.historical[y]; if (h.available && h.shares) histRows.push({ Year: y, "AC No": a.no, AC: a.name, District: a.district, ...Object.fromEntries(bundle.groups.map((g) => [`${g} %`, pct(h.shares?.[g])])) }); }
  utils.book_append_sheet(wb, utils.json_to_sheet(histRows), "Historical AC shares");
  utils.book_append_sheet(wb, utils.json_to_sheet(bundle.calibration.notes.map((n) => ({ Note: n }))), "Calibration notes");
  const provenance = bundle.source.audit.map((x) => ({ Sheet: x.sheet, Rows: x.rows, Use: x.used }));
  provenance.push({ Sheet: "Notes", Rows: bundle.source.notes.length, Use: bundle.source.notes.join(" | ") });
  utils.book_append_sheet(wb, utils.json_to_sheet(provenance), "Provenance");
  const buf = write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="Tamil_Nadu_final_aggregates_${new Date().toISOString().slice(0, 10)}.xlsx"`, "Cache-Control": "no-store" },
  });
}
