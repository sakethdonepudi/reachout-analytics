"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import EChart from "@/components/case-studies/telangana/echart";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import type { SurveyData, SurveyDemoRow, SurveyPeriod } from "@/lib/survey/types";
import { cn } from "@/lib/utils";

const TN_COLOURS: Record<string, string> = {
  TVK: "#F2C200", "DMK+": "#E23B2E", "AIADMK+": "#0F8A4A", NTK: "#F59E0B", Others: "#64748B",
};
const AP_COLOURS: Record<string, string> = {
  NDA: "#F59E0B", YSRCP: "#2563EB", INC: "#16A34A", Others: "#64748B",
};

const int = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("en-IN").format(Math.round(value)));
const pct = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`);
const signed = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? "—" : `${Math.abs(value) < 0.05 ? "0.0" : value > 0 ? "+" : ""}${value.toFixed(1)}pp`);
const stateNameOf = (data: SurveyData) => (data.actual["Tamil Nadu"] ? "Tamil Nadu" : data.actual["Andhra Pradesh"] ? "Andhra Pradesh" : Object.keys(data.actual)[0] ?? "");
const coloursOf = (state: string) => (state === "Tamil Nadu" ? TN_COLOURS : AP_COLOURS);
const colourOf = (state: string, party: string) => coloursOf(state)[party] ?? "#64748B";
const labelOf = (party: string) => party.replace(/\+/g, "+");

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-[var(--a-border)] bg-[var(--a-panel)] p-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--a-muted)]">{label}</p>
      <p className="mt-1 font-display text-[22px] font-semibold leading-none tracking-[-0.02em] text-[var(--a-ink)]">{value}</p>
      {note && <p className="mt-1 text-[9.5px] text-[var(--a-muted)]">{note}</p>}
    </div>
  );
}

function Section({ title, note, children, className }: { title: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("analysis-panel rounded-2xl p-4 sm:p-5", className)} aria-label={title}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[17px] font-semibold leading-tight text-[var(--a-ink)]">{title}</h3>
        {note && <p className="text-[10px] text-[var(--a-muted)]">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export default function SurveyBody({
  data,
  stateSlug,
  stateName,
  initialPeriod,
  initialProfile,
  onPeriodChange,
  onProfileChange,
  onSubPeriodChange,
  onOpenSocial,
  owner = false,
  compact = false,
}: {
  data: SurveyData;
  stateSlug: string;
  stateName: string;
  initialPeriod?: string;
  initialProfile?: string;
  onPeriodChange?: (period: string) => void;
  onProfileChange?: (profile: string) => void;
  onSubPeriodChange?: (year: string) => void;
  onOpenSocial?: (period: string) => void;
  owner?: boolean;
  compact?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const periods = data.periods;
  const catalog = data.periodCatalog ?? Object.entries(periods).map(([key, period]) => ({ key, label: period.label }));
  const keys = catalog.map((item) => item.key);
  const period = initialPeriod && periods[initialPeriod] ? initialPeriod : keys.includes("op") ? "op" : keys[0];
  const current: SurveyPeriod = periods[period];
  const demoMap = current.demo ?? {};
  const demoCatalog = current.demoCatalog ?? Object.fromEntries(Object.entries(demoMap).map(([key, value]) => [key, { label: value.label, cov: value.cov }]));
  const profiles = Object.keys(demoCatalog);
  const profile = initialProfile && demoMap[initialProfile] ? initialProfile : demoMap.age ? "age" : Object.keys(demoMap)[0] ?? "";
  const demo = demoMap[profile];
  const subCatalog = current.subperiodCatalog ?? [];
  const parties = data.parties;
  const colours = coloursOf(stateName);
  const expected = current.expected[stateName] ?? Object.values(current.expected)[0] ?? {};
  const actual = data.actual[stateName] ?? Object.values(data.actual)[0] ?? {};
  const leading = [...parties].sort((a, b) => (expected[b] ?? 0) - (expected[a] ?? 0));
  const lead = leading.length > 1 ? (expected[leading[0]] ?? 0) - (expected[leading[1]] ?? 0) : 0;
  const seats = current.seats as Record<string, unknown>;
  const seatParties = parties.filter((party) => typeof seats[party] === "number");
  const seatTotal = seatParties.reduce((sum, party) => sum + Number(seats[party] ?? 0), 0);
  const zoneNames = Object.keys(current.expected).filter((name) => name !== stateName);
  const zoneSeats = (seats.zones as Record<string, Record<string, unknown>> | undefined) ?? {};
  const actualZones = data.actual;

  const partyChart = useMemo(() => ({
    animation: !reduced,
    grid: { left: 80, right: 28, top: 26, bottom: 20 },
    legend: { top: 0, left: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: "var(--a-muted)", fontSize: 10 } },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (value: unknown) => (typeof value === "number" ? `${value.toFixed(2)}%` : "—") },
    xAxis: { type: "value", max: 100, axisLabel: { color: "var(--a-muted)", fontSize: 9, formatter: "{value}%" }, splitLine: { lineStyle: { color: "var(--a-border)", opacity: 0.55 } } },
    yAxis: { type: "category", data: parties.map(labelOf), inverse: true, axisLabel: { color: "var(--a-ink)", fontSize: 10 }, axisLine: { show: false }, axisTick: { show: false } },
    series: [
      { name: current.label, type: "bar", barMaxWidth: 16, itemStyle: { borderRadius: 2 }, data: parties.map((party) => ({ value: expected[party] ?? null, itemStyle: { color: colours[party] ?? "#64748B" } })) },
      { name: "Actual", type: "bar", barMaxWidth: 16, barGap: "18%", itemStyle: { borderRadius: 2 }, data: parties.map((party) => ({ value: actual[party] ?? null, itemStyle: { color: "#0B0B0C", opacity: 0.2 } })) },
    ],
  }), [parties, expected, actual, current.label, colours, reduced]);

  const profileRows = useMemo(() => {
    const rows = demo?.rows ?? [];
    const top = [...rows].sort((a, b) => b.n - a.n).slice(0, 18);
    const labels = top.map((row) => row.g);
    return {
      rows,
      labels,
      option: {
        animation: !reduced,
        grid: { left: 42, right: 16, top: 30, bottom: 52 },
        legend: { top: 0, left: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: "var(--a-muted)", fontSize: 9.5 } },
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (value: unknown) => (typeof value === "number" ? `${value.toFixed(1)}%` : "—") },
        xAxis: { type: "category", data: labels, axisLabel: { color: "var(--a-muted)", fontSize: 9, interval: 0, rotate: labels.length > 6 ? 24 : 0 }, axisLine: { show: false }, axisTick: { show: false } },
        yAxis: { type: "value", max: 100, axisLabel: { color: "var(--a-muted)", fontSize: 9, formatter: "{value}%" }, splitLine: { lineStyle: { color: "var(--a-border)", opacity: 0.55 } } },
        series: parties.map((party, index) => ({
          name: labelOf(party), type: "bar", barMaxWidth: 16,
          itemStyle: { color: colours[party] ?? "#64748B", borderRadius: [2, 2, 0, 0] },
          data: top.map((row) => row.v[index] ?? null),
        })),
      },
    };
  }, [demo, parties, colours, reduced]);

  const swingRows = useMemo(() => {
    const zones = zoneNames.filter((zone) => actualZones[zone]);
    return zones.map((zone) => {
      const before = current.expected[zone] ?? {};
      const after = actualZones[zone] ?? {};
      return { zone, values: parties.map((party) => ({ party, value: (before[party] ?? 0) - (after[party] ?? 0) })) };
    });
  }, [zoneNames, actualZones, current.expected, parties]);

  const swingChart = useMemo(() => ({
    animation: !reduced,
    grid: { left: 46, right: 16, top: 30, bottom: 42 },
    legend: { top: 0, left: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: "var(--a-muted)", fontSize: 9.5 } },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (value: unknown) => (typeof value === "number" ? `${value > 0 ? "+" : ""}${value.toFixed(1)}pp` : "—") },
    xAxis: { type: "category", data: swingRows.map((row) => row.zone), axisLabel: { color: "var(--a-muted)", fontSize: 9, interval: 0, rotate: 18 }, axisLine: { show: false }, axisTick: { show: false } },
    yAxis: { type: "value", axisLabel: { color: "var(--a-muted)", fontSize: 9, formatter: (value: number) => `${value > 0 ? "+" : ""}${value}` }, splitLine: { lineStyle: { color: "var(--a-border)", opacity: 0.55 } } },
    series: parties.map((party) => ({
      name: labelOf(party), type: "bar", barMaxWidth: 16,
      itemStyle: { color: colours[party] ?? "#64748B", borderRadius: 2 },
      data: swingRows.map((row) => row.values.find((value) => value.party === party)?.value ?? null),
    })),
  }), [swingRows, parties, colours, reduced]);

  const ads = data.ads as unknown as Record<string, unknown>;
  const adsTotal = (ads.total as Record<string, number> | undefined) ?? {};
  const adsPeriods = (ads.periods as Record<string, Record<string, number | string>> | undefined) ?? {};
  const adsPeriodKey = period === "rs" || period === "rd" ? "post" : period;
  const adsPeriod = adsPeriods[adsPeriodKey] ?? adsPeriods[period] ?? adsTotal;
  const adsLabel = String((adsPeriod as Record<string, unknown>).label ?? ads.label ?? "Meta ads");
  const showSpend = owner || adsTotal.spend != null;
  const seatBars = seatParties.map((party) => ({ party, value: Number(seats[party] ?? 0) }));

  return (
    <div className="space-y-4">
      <div className="analysis-panel rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--a-brass)]">Survey dashboard</p>
            <h3 className="mt-0.5 font-display text-[20px] font-semibold tracking-[-0.02em] text-[var(--a-ink)]">{stateName} · {current.label}</h3>
            <p className="mt-1 text-[11px] text-[var(--a-muted)]">{int(current.n)} responses · {current.from || "—"} to {current.to || "—"}{current.nw ? ` · ${int(current.nw)} weighted` : ""}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Survey period">
              {keys.map((key) => (
                <button key={key} type="button" aria-pressed={period === key} onClick={() => onPeriodChange?.(key)}
                  className={cn("min-h-9 rounded-full border px-3 text-[10.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-brass)]/50", period === key ? "border-[var(--a-brass)]/50 bg-[var(--a-brass-soft)] text-[var(--a-ink)]" : "border-[var(--a-border)] text-[var(--a-muted)] hover:text-[var(--a-ink)]")}>
                  {(catalog.find((item) => item.key === key)?.label ?? periods[key]?.label ?? key).replace(/\s*\(.*/, "")}
                </button>
              ))}
            </div>
            {subCatalog.length > 1 && (
              <div className="flex flex-wrap justify-end gap-1" role="group" aria-label="Post-poll year">
                {subCatalog.map((item) => (
                  <button key={item.key} type="button" aria-pressed={current.subperiod === item.key} onClick={() => onSubPeriodChange?.(item.key)}
                    className={cn("min-h-7 rounded-full border px-2.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-brass)]/50", current.subperiod === item.key ? "border-[var(--a-brass)]/50 bg-[var(--a-brass-soft)] text-[var(--a-ink)]" : "border-[var(--a-border)] text-[var(--a-muted)] hover:text-[var(--a-ink)]")}>
                    {item.label.replace(/\s*\(.*/, "")}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Responses" value={int(current.n)} note={`${int(current.nw ?? current.n)} weighted`} />
          <Kpi label="Leading party" value={labelOf(leading[0] ?? "—")} note={`${pct(expected[leading[0]] ?? 0)} · ${signed(lead)} lead`} />
          <Kpi label="Projected seats" value={int(seatTotal)} note={seatParties.map((party) => `${labelOf(party)} ${int(Number(seats[party] ?? 0))}`).join(" · ")} />
          <Kpi label="Seat call" value={typeof seats.hit === "number" ? int(seats.hit) : "—"} note={typeof seats.hit === "number" ? "Seats called correctly" : `${zoneNames.length} zones`} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)]">
          <div className="rounded-xl border border-[var(--a-border)] bg-[var(--a-panel-2)] p-2">
            <p className="px-1 pb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--a-muted)]">Vote share · {current.label} vs actual</p>
            <EChart option={partyChart} height={compact ? 260 : 300} reduced={reduced} ariaLabel={`Vote share for ${stateName}`} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--a-border)]" tabIndex={0} role="region" aria-label="Vote share table">
            <table className="w-full min-w-[280px] border-collapse text-[10px]">
              <thead><tr className="border-b border-[var(--a-border)] text-left text-[8px] uppercase tracking-wide text-[var(--a-muted)]"><th className="px-2 py-2">Party</th><th className="px-2 py-2 text-right">{current.label}</th><th className="px-2 py-2 text-right">Actual</th><th className="px-2 py-2 text-right">Swing</th></tr></thead>
              <tbody>{parties.map((party) => <tr key={party} className="border-t border-[var(--a-border)]/70"><th scope="row" className="px-2 py-1.5 text-left font-medium"><span className="mr-1.5 inline-block size-1.5 rounded-sm align-middle" style={{ background: colours[party] ?? "#64748B" }} />{labelOf(party)}</th><td className="px-2 py-1.5 text-right tabular-nums">{pct(expected[party])}</td><td className="px-2 py-1.5 text-right tabular-nums">{pct(actual[party])}</td><td className="px-2 py-1.5 text-right tabular-nums">{signed((expected[party] ?? 0) - (actual[party] ?? 0))}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </div>

      {profiles.length > 0 && (
      <Section title={`Raw ${current.target ?? current.last ?? ""} vote % by voter profile`} note={demo?.cov}>
        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Voter profile">
          {profiles.map((key) => (
            <button key={key} type="button" role="tab" aria-selected={profile === key} onClick={() => onProfileChange?.(key)}
              className={cn("min-h-8 rounded-full border px-2.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-brass)]/50", profile === key ? "border-[var(--a-brass)]/50 bg-[var(--a-brass-soft)] text-[var(--a-ink)]" : "border-[var(--a-border)] text-[var(--a-muted)] hover:text-[var(--a-ink)]")}>
              {demoCatalog[key]?.label ?? key}
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-[var(--a-border)] bg-[var(--a-panel-2)] p-2">
          <EChart option={profileRows.option} height={compact ? 280 : 340} reduced={reduced} ariaLabel={`${demo?.label ?? "Profile"} vote share`} />
        </div>
        <div className="mt-3 max-h-[320px] overflow-auto rounded-xl border border-[var(--a-border)]" tabIndex={0} role="region" aria-label="Voter profile table">
          <table className="w-full min-w-[520px] border-collapse text-[9.5px]">
            <thead className="sticky top-0 bg-[var(--a-panel)]"><tr className="border-b border-[var(--a-border)] text-left text-[8px] uppercase tracking-wide text-[var(--a-muted)]"><th className="px-2 py-1.5">Group</th><th className="px-2 py-1.5 text-right">n</th>{parties.map((party) => <th key={party} className="px-2 py-1.5 text-right">{labelOf(party)}</th>)}</tr></thead>
            <tbody>{(demo?.rows ?? []).map((row: SurveyDemoRow) => <tr key={row.g} className="border-t border-[var(--a-border)]/70"><th scope="row" className="px-2 py-1.5 text-left font-medium">{row.g}</th><td className="px-2 py-1.5 text-right tabular-nums">{int(row.n)}</td>{parties.map((_party, index) => <td key={index} className="px-2 py-1.5 text-right tabular-nums">{pct(row.v[index])}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </Section>

      )}
      <Section title="Zone swing" note="Poll share minus actual share">
        <div className="mt-3 rounded-xl border border-[var(--a-border)] bg-[var(--a-panel-2)] p-2">
          <EChart option={swingChart} height={compact ? 260 : 300} reduced={reduced} ariaLabel="Zone swing by party" />
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--a-border)]" tabIndex={0} role="region" aria-label="Zone swing table">
          <table className="w-full min-w-[500px] border-collapse text-[9.5px]"><thead><tr className="border-b border-[var(--a-border)] text-left text-[8px] uppercase tracking-wide text-[var(--a-muted)]"><th className="px-2 py-1.5">Zone</th>{parties.map((party) => <th key={party} className="px-2 py-1.5 text-right">{labelOf(party)}</th>)}</tr></thead><tbody>{swingRows.map((row) => <tr key={row.zone} className="border-t border-[var(--a-border)]/70"><th scope="row" className="px-2 py-1.5 text-left font-medium">{row.zone}</th>{parties.map((party) => <td key={party} className="px-2 py-1.5 text-right tabular-nums">{signed(row.values.find((value) => value.party === party)?.value ?? null)}</td>)}</tr>)}</tbody></table>
        </div>
      </Section>

      <Section title="Seats by zone" note={`${int(seatTotal)} seats projected`}>
        <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="rounded-xl border border-[var(--a-border)] bg-[var(--a-panel-2)] p-3">
            <div className="space-y-2">{seatBars.map((row) => <div key={row.party} className="flex items-center gap-2 text-[10px]"><span className="w-16 shrink-0 text-[var(--a-muted)]">{labelOf(row.party)}</span><span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--a-border)]/40"><span className="block h-full rounded-full" style={{ width: `${seatTotal ? (row.value / seatTotal) * 100 : 0}%`, background: colours[row.party] ?? "#64748B" }} /></span><span className="w-10 text-right tabular-nums">{int(row.value)}</span></div>)}</div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--a-border)]" tabIndex={0} role="region" aria-label="Seats by zone table">
            <table className="w-full min-w-[420px] border-collapse text-[9.5px]"><thead><tr className="border-b border-[var(--a-border)] text-left text-[8px] uppercase tracking-wide text-[var(--a-muted)]"><th className="px-2 py-1.5">Zone</th>{seatParties.map((party) => <th key={party} className="px-2 py-1.5 text-right">{labelOf(party)}</th>)}<th className="px-2 py-1.5 text-right">ACs</th></tr></thead><tbody>{Object.entries(zoneSeats).map(([zone, row]) => <tr key={zone} className="border-t border-[var(--a-border)]/70"><th scope="row" className="px-2 py-1.5 text-left font-medium">{zone}</th>{seatParties.map((party) => <td key={party} className="px-2 py-1.5 text-right tabular-nums">{int(Number(row[party] ?? 0))}</td>)}<td className="px-2 py-1.5 text-right tabular-nums text-[var(--a-muted)]">{int(Number(row.acs ?? 0))}</td></tr>)}</tbody></table>
          </div>
        </div>
      </Section>

      <Section title="Ads" note={adsLabel}>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi label="Campaigns" value={int(Number((adsPeriod as Record<string, unknown>).n ?? adsTotal.n ?? 0))} />
          <Kpi label="Reach" value={int(Number((adsPeriod as Record<string, unknown>).reach ?? adsTotal.reach ?? 0))} />
          <Kpi label="Impressions" value={int(Number((adsPeriod as Record<string, unknown>).impr ?? adsTotal.impr ?? 0))} />
          <Kpi label="Clicks" value={int(Number((adsPeriod as Record<string, unknown>).clicks ?? adsTotal.clicks ?? 0))} />
          <Kpi label="Engagement" value={int(Number((adsPeriod as Record<string, unknown>).eng ?? adsTotal.eng ?? 0))} />
        </div>
        {showSpend && <p className="mt-2 text-[10px] text-[var(--a-muted)]">Spend: ₹{int(Number((adsPeriod as Record<string, unknown>).spend ?? adsTotal.spend ?? 0))}</p>}
        {onOpenSocial && <button type="button" onClick={() => onOpenSocial(period)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--a-ink)] px-4 text-[11px] font-semibold text-[var(--a-ink)] transition-colors hover:bg-[var(--a-ink)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-brass)]/50">Open Social Media <ArrowUpRight className="size-3.5" /></button>}
      </Section>

      <Section title="Method & caveats">
        <div className="mt-2 space-y-2 text-[11px] leading-relaxed text-[var(--a-muted)]">
          <p>{int(current.n)} responses collected {current.from || "—"} to {current.to || "—"}; {int(current.nw ?? current.n)} weighted responses. The dashboard shows the survey aggregate, not individual responses.</p>
          <p>Vote shares are rounded to one decimal. Seat projections use the state's zone-level model; seats are indicative. Groups with fewer than 30 responses are hidden where the source does.</p>
          <p>Source: {stateName} survey dashboard. The map, tables and charts here use the same uploaded dataset.</p>
        </div>
      </Section>
    </div>
  );
}
