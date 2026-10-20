import type { NextRequest } from "next/server";
import { utils, write } from "xlsx";
import { requireAdmin } from "@/lib/auth";
import { DATA } from "@/lib/telangana/oct26";
import { HISTORY, winnerLabel } from "@/lib/telangana/history";
import { exportOct26Provenance } from "@/lib/telangana/oct26-import";
import { PACK_FILES, packProvenance } from "@/lib/telangana/pack-import";

export const runtime = "nodejs";
export const maxDuration = 60;

const pct = (n: number) => Math.round(n * 10000) / 100;

/** Aggregates workbook (default) or JSON provenance for the active validated snapshot. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const format = req.nextUrl.searchParams.get("format") === "json" ? "json" : "xlsx";

  if (format === "json") {
    return new Response(JSON.stringify({ ...exportOct26Provenance(), pack: packProvenance() }, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="Telangana_pack_provenance_${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" },
    });
  }

  const wb = utils.book_new();
  const historyRows = [];
  for (const year of ["2014", "2018", "2023"] as const) {
    for (const a of HISTORY.years[year].acs) {
      historyRows.push({
        Year: year, "AC No": a.no, Assembly: a.name, "District grouping": a.district,
        "BRS %": pct(a.shares.BRS), "Congress+ %": pct(a.shares.Congress), "BJP %": pct(a.shares.BJP), "Others %": pct(a.shares.Others),
        "Total votes": a.total, "Winner party": a.winnerParty, "Winner label": winnerLabel(a.winnerParty), "Winner votes": a.winnerVotes, "Winner share %": pct(a.winnerShare),
      });
    }
  }
  utils.book_append_sheet(wb, utils.json_to_sheet(historyRows), "2014-2023 history");

  const predictionRows = DATA.acs.map((a) => ({
    "AC No": a.no, Assembly: a.name, "District grouping": a.district,
    "BRS %": pct(a.prediction.BRS), "Congress+ %": pct(a.prediction.Congress), "BJP %": pct(a.prediction.BJP), "Others %": pct(a.prediction.Others),
    "Predicted leader": a.leader, Tie: a.tied.join(" / "), "2023 vote weight": a.votes2023, Basis: a.override ? "prediction override" : "supplied model",
  }));
  utils.book_append_sheet(wb, utils.json_to_sheet(predictionRows), "2028 predictions");

  const statRows = HISTORY.stats.flatMap((s) => [{
    "From year": s.fromYear, "To year": s.toYear, Party: s.party, Assemblies: s.assemblies.length,
    "Median pp": s.medianPp, "Q1 pp": s.q1Pp, "Q3 pp": s.q3Pp, "Lower fence": s.lowerFencePp, "Upper fence": s.upperFencePp,
    "Outliers": s.assemblies.filter((a) => a.outlier).length,
  }]);
  utils.book_append_sheet(wb, utils.json_to_sheet(statRows), "Swing statistics");

  const brandRows = HISTORY.devices.brands.map((b) => ({ Brand: b.brand, Entries: b.entries, "Entry share %": pct(b.share) }));
  utils.book_append_sheet(wb, utils.json_to_sheet(brandRows), "Device brand mix");

  const acBrandRows = Object.entries(HISTORY.devices.byAc).flatMap(([no, rec]) =>
    rec.brands.map((b) => ({ "AC No": Number(no), Brand: b.brand, Entries: b.entries, "AC share %": pct(b.share) })),
  );
  utils.book_append_sheet(wb, utils.json_to_sheet(acBrandRows), "Device by assembly");

  const provenance = [
    { Item: "Pack version", Value: "tg-2014-2028-v1" },
    { Item: "2028 source", Value: DATA.sourceFile },
    { Item: "2028 SHA-256", Value: DATA.sourceHash },
    { Item: "2028 cutoff", Value: DATA.cutoff },
    { Item: "Override version", Value: DATA.overrideVersion },
    { Item: "2014 total votes", Value: HISTORY.years["2014"].total },
    { Item: "2018 total votes", Value: HISTORY.years["2018"].total },
    { Item: "2023 total votes", Value: HISTORY.years["2023"].total },
    { Item: "Device entries (October cutoff)", Value: HISTORY.devices.total },
    ...PACK_FILES.map((f) => ({ Item: `Workbook SHA-256 · ${f.name}`, Value: f.sha256 })),
    { Item: "Note", Value: "Historical actuals are not exit polls; 2028 is a prediction. Aggregates only, no Entry IDs or raw rows." },
    { Item: "Exported", Value: new Date().toISOString() },
  ];
  utils.book_append_sheet(wb, utils.json_to_sheet(provenance), "Provenance");

  const buf = write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Telangana_aggregates_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
