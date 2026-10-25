import type { NextRequest } from "next/server";
import { utils, write } from "xlsx";
import aggregates from "@/lib/data/tamil-nadu/aggregates.json";
import type { TnAggregates } from "@/lib/tamil-nadu/model";
import { requireAdmin } from "@/lib/auth";
import { getPublishedAllocation } from "@/lib/tamil-nadu/allocation-store";

export const runtime = "nodejs";
export const maxDuration = 60;

const GROUPS = ["TVK", "AIADMK+BJP+PMK+AMMK", "DMK+INC+VCK", "NTK", "NOTA"] as const;
const pct = (n: number | undefined) => (n == null ? "" : Math.round(n * 10000) / 100);

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const published = await getPublishedAllocation();
  const bundle = (published?.bundle ?? aggregates) as TnAggregates;
  const format = req.nextUrl.searchParams.get("format") === "json" ? "json" : "xlsx";
  if (format === "json") {
    return new Response(JSON.stringify({ publishedAt: published?.publishedAt ?? null, allocation: bundle.allocation, districts: bundle.districts, acs: bundle.acs }, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="Tamil_Nadu_allocation_${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" },
    });
  }

  const wb = utils.book_new();
  const a = bundle.allocation;
  const summary = [
    ["Item", "Value"],
    ["Allocation version", a.version],
    ["Method", a.method],
    ["Priority", a.priority],
    ["Source import ID", a.sourceImportId],
    ["Source file", a.sourceFile],
    ["Source SHA-256", a.sourceHash],
    ["Published at", published?.publishedAt ?? "not published"],
    ["Recorded assembly", Object.values(a.recorded.assembly).reduce((x, y) => x + y, 0)],
    ["Recorded district", Object.values(a.recorded.district).reduce((x, y) => x + y, 0)],
    ["District-only allocated", Object.values(a.allocated.districtOnly).reduce((x, y) => x + y, 0)],
    ["Unlocated allocated", Object.values(a.allocated.unlocated).reduce((x, y) => x + y, 0)],
    ["Combined assembly", a.reconcile.combinedAssembly],
    ["Combined district", a.reconcile.combinedDistrict],
    ["Combined statewide", a.reconcile.combinedStatewide],
    ["Party totals unchanged", a.reconcile.partyTotalsUnchanged],
    ["AC = district", a.reconcile.acDistrictEqual],
    ["district = state", a.reconcile.districtStateEqual],
    ["No double count", a.reconcile.noDoubleCount],
    ["Workbook projected seats", JSON.stringify(a.workbook.projectedSeats)],
    ["Workbook accuracy", a.workbook.accuracy],
  ];
  for (const g of GROUPS) {
    summary.push([`Recorded assembly · ${g}`, a.recorded.assembly[g]]);
    summary.push([`Recorded district · ${g}`, a.recorded.district[g]]);
    summary.push([`District-only · ${g}`, a.recorded.districtOnly[g]]);
    summary.push([`Unlocated · ${g}`, a.recorded.unlocated[g]]);
    summary.push([`Combined · ${g}`, a.combined.statewide[g]]);
  }
  utils.book_append_sheet(wb, utils.json_to_sheet(summary), "Allocation summary");

  const assemblyRows = bundle.acs.map((ac) => {
    const row: Record<string, string | number | boolean> = {
      "AC No": ac.no, Assembly: ac.name, District: ac.district, "District (ECI)": ac.districtEci,
      "Recorded total": ac.recorded.valid, "District-only total": ac.allocatedDistrictOnly ? Object.values(ac.allocatedDistrictOnly).reduce((x, y) => x + y, 0) : 0,
      "Unlocated total": ac.allocatedUnlocated ? Object.values(ac.allocatedUnlocated).reduce((x, y) => x + y, 0) : 0,
      "Combined total": ac.combined.valid,
      "Combined leader": ac.combined.leader ?? "", "Combined margin (pp)": ac.combined.marginPp,
      "Projected leader": ac.projected.leader ?? "", "Projected confidence": ac.projected.confidence,
      "Workbook adjusted leader": ac.workbook.projection.leader ?? "", "Workbook margin (pp)": ac.workbook.projection.marginPp,
      "Workbook confidence": ac.workbook.projection.confidence, "Actual 2026": ac.actual2026.winner ?? "", Match: ac.match,
    };
    for (const g of GROUPS) {
      row[`Recorded ${g}`] = ac.recorded.counts[g];
      row[`District-only ${g}`] = ac.allocatedDistrictOnly[g];
      row[`Unlocated ${g}`] = ac.allocatedUnlocated[g];
      row[`Combined ${g}`] = ac.combined.counts[g];
      row[`Combined share ${g} %`] = pct(ac.combined.shares?.[g]);
    }
    return row;
  });
  utils.book_append_sheet(wb, utils.json_to_sheet(assemblyRows), "Assembly allocation");

  const districtRows = bundle.districts.map((d) => {
    const row: Record<string, string | number> = {
      District: d.name, ACs: d.acs.length, "Recorded total": d.recorded.valid,
      "District-only total": Object.values(d.allocatedDistrictOnly).reduce((x, y) => x + y, 0),
      "Unlocated total": Object.values(d.allocatedUnlocated).reduce((x, y) => x + y, 0),
      "Combined total": d.combined.valid, "Combined leader": d.combined.leader ?? "", "Combined margin (pp)": d.combined.marginPp,
      "Projected seats": JSON.stringify(d.projectedSeats), "Actual 2026 seats": JSON.stringify(d.actualSeats),
      "Workbook projected seats": JSON.stringify(d.workbook.projectedSeats),
    };
    for (const g of GROUPS) {
      row[`Recorded ${g}`] = d.recorded.counts[g];
      row[`District-only ${g}`] = d.allocatedDistrictOnly[g];
      row[`Unlocated ${g}`] = d.allocatedUnlocated[g];
      row[`Combined ${g}`] = d.combined.counts[g];
      row[`Combined share ${g} %`] = pct(d.combined.shares?.[g]);
    }
    return row;
  });
  utils.book_append_sheet(wb, utils.json_to_sheet(districtRows), "District allocation");

  const stateRows = GROUPS.map((g) => ({
    Group: g, "Recorded statewide": bundle.statewide.recorded.counts[g],
    "Combined statewide": bundle.statewide.combined.counts[g],
    "Combined share %": pct(bundle.statewide.combined.shares?.[g]),
    "District-only": a.recorded.districtOnly[g], Unlocated: a.recorded.unlocated[g],
    "Combined projected seats": bundle.statewide.projectedSeats[g], "Workbook projected seats": bundle.statewide.workbookProjectedSeats[g],
    "Actual 2026 seats": bundle.statewide.actualSeats[g],
  }));
  utils.book_append_sheet(wb, utils.json_to_sheet(stateRows), "Statewide");

  const reconciliation = [
    { Check: "Recorded assembly", Value: a.reconcile.assemblyRecorded, Expected: 10_567, Pass: a.reconcile.assemblyRecorded === 10_567 },
    { Check: "District-only allocated", Value: a.reconcile.districtOnlyAllocated, Expected: 882, Pass: a.reconcile.districtOnlyAllocated === 882 },
    { Check: "Unlocated allocated", Value: a.reconcile.unlocatedAllocated, Expected: 19_867, Pass: a.reconcile.unlocatedAllocated === 19_867 },
    { Check: "Combined assembly", Value: a.reconcile.combinedAssembly, Expected: 31_316, Pass: a.reconcile.combinedAssembly === 31_316 },
    { Check: "Combined district", Value: a.reconcile.combinedDistrict, Expected: 31_316, Pass: a.reconcile.combinedDistrict === 31_316 },
    { Check: "Party totals unchanged", Value: a.reconcile.partyTotalsUnchanged, Expected: true, Pass: a.reconcile.partyTotalsUnchanged },
    { Check: "AC = district", Value: a.reconcile.acDistrictEqual, Expected: true, Pass: a.reconcile.acDistrictEqual },
    { Check: "District = state", Value: a.reconcile.districtStateEqual, Expected: true, Pass: a.reconcile.districtStateEqual },
    { Check: "No double count", Value: a.reconcile.noDoubleCount, Expected: true, Pass: a.reconcile.noDoubleCount },
    { Check: "Combined projected accuracy", Value: bundle.statewide.accuracy, Expected: "derived", Pass: true },
    { Check: "Workbook original accuracy", Value: bundle.statewide.workbookAccuracy, Expected: 110, Pass: bundle.statewide.workbookAccuracy === 110 },
  ];
  utils.book_append_sheet(wb, utils.json_to_sheet(reconciliation), "Reconciliation");

  const buf = write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Tamil_Nadu_allocation_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
