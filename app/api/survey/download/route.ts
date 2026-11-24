import type { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { getActiveSurvey } from "@/lib/survey/store";
import { getActiveTnMap } from "@/lib/tamil-nadu/map-store";
import { tnSocialOverview } from "@/lib/survey/tn-view-dto";
import type { SurveyData, SurveyPeriod, SurveyShare } from "@/lib/survey/types";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const maxDuration = 60;

const STATE = "Tamil Nadu";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

function leading(shares: SurveyShare | undefined, parties: string[]) {
  if (!shares) return "";
  return [...parties].sort((a, b) => (shares[b] ?? 0) - (shares[a] ?? 0))[0] ?? "";
}

function flatten(data: SurveyData) {
  const rows: Array<{ periodKey: string; slotKey: string; label: string; period: SurveyPeriod }> = [];
  for (const [periodKey, period] of Object.entries(data.periods)) {
    rows.push({ periodKey, slotKey: "all", label: period.label, period });
    for (const [monthKey, month] of Object.entries(period.months ?? {})) {
      rows.push({ periodKey, slotKey: monthKey, label: month.label, period: month });
      for (const [subKey, sub] of Object.entries(month.sub ?? {})) rows.push({ periodKey, slotKey: subKey, label: sub.label, period: sub });
    }
  }
  return rows;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const state = new URL(req.url).searchParams.get("state") ?? "tamil-nadu";
  if (state !== "tamil-nadu") return Response.json({ ok: false, error: "Only Tamil Nadu is available." }, { status: 400, headers });
  const record = await getActiveSurvey("tamil-nadu");
  if (!record) return Response.json({ ok: false, error: "Survey dashboard not uploaded." }, { status: 404, headers });
  const data = record.data;
  const parties = data.parties;
  const map = await getActiveTnMap();
  const social = await tnSocialOverview(data, true);
  const workbook = XLSX.utils.book_new();
  const sheet = (name: string, rows: unknown[][]) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);

  sheet("Meta", [
    ["key", "value"],
    ["state", "tamil-nadu"],
    ["state_name", STATE],
    ["survey_version", record.version],
    ["survey_file", record.fileName ?? ""],
    ["n_total", data.n_total],
    ["periods", Object.keys(data.periods).join(", ")],
    ["map_version", map?.version ?? ""],
    ["exported_at", new Date().toISOString()],
    ["contains_respondent_rows", "no"],
  ]);

  sheet("Periods", [
    ["period", "label", "n", "nw", "from", "to", "actual", "last", "target", ...parties],
    ...Object.entries(data.periods).map(([key, period]) => {
      const shares = period.expected[STATE] ?? {};
      return [key, period.label, period.n, period.nw ?? "", period.from ?? "", period.to ?? "", period.actual == null ? "" : String(period.actual), period.last ?? "", period.target ?? "", ...parties.map((party) => shares[party] ?? "")];
    }),
  ]);

  const flat = flatten(data);
  sheet("Slots", [
    ["period", "slot", "label", "n", "from", "to", "leading", ...parties, "seat_total", "seat_hit"],
    ...flat.map((item) => {
      const shares = item.period.expected[STATE] ?? {};
      const seats = item.period.seats as Record<string, unknown>;
      const total = parties.reduce((sum, party) => sum + (typeof seats[party] === "number" ? Number(seats[party]) : 0), 0);
      return [item.periodKey, item.slotKey, item.label, item.period.n, item.period.from ?? "", item.period.to ?? "", leading(shares, parties), ...parties.map((party) => shares[party] ?? ""), total, typeof seats.hit === "number" ? seats.hit : ""];
    }),
  ]);

  const profileRows: unknown[][] = [["period", "slot", "profile", "profile_label", "coverage", "group", "n", "leading", ...parties]];
  for (const item of flat) {
    for (const [profileKey, demo] of Object.entries(item.period.demo ?? {})) {
      for (const row of demo.rows) {
        profileRows.push([item.periodKey, item.slotKey, profileKey, demo.label, demo.cov ?? "", row.g, row.n, parties[row.v.indexOf(Math.max(...row.v))] ?? "", ...parties.map((_, index) => row.v[index] ?? "")]);
      }
    }
  }
  sheet("Profiles", profileRows);

  const zoneRows: unknown[][] = [["period", "slot", "region", "n", "baseline", ...parties]];
  for (const item of flat) {
    for (const [region, shares] of Object.entries(item.period.expected)) {
      const baseline = data.base?.[region];
      zoneRows.push([item.periodKey, item.slotKey, region, data.periods[item.periodKey]?.demo?.zone?.rows.find((row) => row.g === region)?.n ?? "", baseline ? parties.map((party) => baseline[party] ?? "").join(", ") : "", ...parties.map((party) => shares[party] ?? "")]);
    }
  }
  sheet("Zones", zoneRows);

  const seatRows: unknown[][] = [["period", "slot", "party", "seats"]];
  for (const item of flat) {
    const seats = item.period.seats;
    for (const party of parties) if (typeof seats[party] === "number") seatRows.push([item.periodKey, item.slotKey, party, seats[party]]);
    if (typeof seats.hit === "number") seatRows.push([item.periodKey, item.slotKey, "hit", seats.hit]);
  }
  sheet("Seats", seatRows);

  const districtRows: unknown[][] = [["district", "acs", "TVK", "DMK+", "AIADMK+", "top"]];
  for (const row of data.periods.rs?.dist ?? []) {
    const top = ["TVK", "DMK+", "AIADMK+"].sort((a, b) => Number(row[b] ?? 0) - Number(row[a] ?? 0))[0];
    districtRows.push([row.d, row.acs, row["TVK"] ?? 0, row["DMK+"] ?? 0, row["AIADMK+"] ?? 0, top]);
  }
  sheet("ResultDistricts", districtRows);

  const mapRows: unknown[][] = [["version", "slot", "label", "kind", "level", "name", "n", ...parties]];
  for (const slot of Object.values(map?.slots ?? {})) {
    for (const [name, row] of Object.entries(slot.districts)) mapRows.push([map?.version ?? "", slot.key, slot.label, slot.kind, "district", name, row.n, ...parties.map((party) => row.shares?.[party] ?? "")]);
    for (const [name, row] of Object.entries(slot.acs)) mapRows.push([map?.version ?? "", slot.key, slot.label, slot.kind, "ac", name, row.n, ...parties.map((party) => row.shares?.[party] ?? "")]);
  }
  sheet("MapAggregates", mapRows);

  const socialRows: unknown[][] = [["level", "key", "label", "campaigns", "reach", "impressions", "views", "clicks", "engagement", "responses"]];
  socialRows.push(["total", "all", social.label, social.totals.campaigns, social.totals.reach, social.totals.impressions, social.totals.views, social.totals.clicks, social.totals.engagements, ""]);
  for (const period of social.periods) socialRows.push(["period", period.key, period.label, period.campaigns, period.reach, period.impressions, period.views, period.clicks, period.engagements, period.responses ?? ""]);
  for (const account of social.accounts) socialRows.push(["account", account.id, account.name, account.campaignCount, account.reach, account.impressions, account.views, account.clicks, account.engagements, ""]);
  sheet("Social", socialRows);

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  await audit({ action: "survey_download", role: "owner", meta: { state: "tamil-nadu", surveyVersion: record.version, mapVersion: map?.version ?? null } });
  return new Response(new Uint8Array(buffer), {
    headers: {
      ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="tamil-nadu-survey-export.xlsx"`,
    },
  });
}
