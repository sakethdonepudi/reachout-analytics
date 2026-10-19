"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Check, ChevronRight, Layers, MapPin, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { TG_PARTIES, PARTY_META, partyMeta } from "@/lib/telangana/parties";
import {
  acsInScope, combineAcs, fmtInt, fmtPct, fmtPp, leadingParty, partyShares, SMALL_SAMPLE,
  type AcRecord, type Baseline,
} from "@/lib/telangana/model";
import { cn } from "@/lib/utils";
import TelanganaCharts, { type ChartId, type ScopeData } from "./telangana-charts";
import AboutTelangana from "./about-telangana";
import type { MapTheme } from "./telangana-map";

const TelanganaMap = dynamic(() => import("./telangana-map"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading Telangana…</div>,
});

type Payload = Baseline & {
  published: boolean;
  importVersion: string | null;
  importAt: string | null;
  historicalSourceVersion: string;
  originalEntrySource: string;
};

const CONTESTED = ["BRS", "INC", "BJP", "AIMIM", "TDP", "JSP", "Others"] as const;
const LABEL = "text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";

export default function TelanganaDashboard() {
  const { theme } = useTheme();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* one selection state owns geography, filters and chart scope */
  const [group, setGroup] = useState<string | null>(null);
  const [selectedAcs, setSelectedAcs] = useState<number[]>([]);
  const [layer, setLayer] = useState<"party" | "device">("party");
  const [showLabels, setShowLabels] = useState(false);
  const [chart, setChart] = useState<ChartId>("share");
  const [parties, setParties] = useState<string[]>([...CONTESTED]);
  const [resetNonce, setResetNonce] = useState(0);
  const [hover, setHover] = useState<{ ac: number; x: number; y: number } | null>(null);
  const [acFilter, setAcFilter] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/public/case-studies/telangana/aggregates", { cache: "no-store", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Payload) => { if (!ctrl.signal.aborted) setData(d); })
      .catch((e) => { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Could not load Telangana aggregates"); });
    return () => ctrl.abort();
  }, []);

  const acByNo = useMemo(() => new Map((data?.acs ?? []).map((a) => [a.no, a])), [data]);
  const groups = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, { group: string; acs: AcRecord[] }>();
    for (const a of data.acs) {
      const g = m.get(a.group) ?? { group: a.group, acs: [] };
      g.acs.push(a);
      m.set(a.group, g);
    }
    return [...m.values()].sort((a, b) => a.group.localeCompare(b.group));
  }, [data]);

  const scopeAcs = useMemo(() => (data ? acsInScope(data, { district: group, acs: selectedAcs }) : []), [data, group, selectedAcs]);
  const agg = useMemo(() => combineAcs(scopeAcs), [scopeAcs]);

  const shares2028 = useMemo(() => partyShares(agg.a2028, [...TG_PARTIES], agg.answered2028).filter((s) => parties.includes(s.party)), [agg, parties]);
  const shares2023 = useMemo(() => partyShares(agg.v2023, [...TG_PARTIES], agg.total2023), [agg]);
  const shares2018 = useMemo(() => partyShares(agg.v2018, [...TG_PARTIES], agg.total2018), [agg]);

  const scope: ScopeData = useMemo(() => ({
    label: selectedAcs.length
      ? selectedAcs.length === 1 ? acByNo.get(selectedAcs[0])?.name ?? "1 assembly" : `${selectedAcs.length} assemblies`
      : group ?? "Statewide",
    acs: scopeAcs,
    counts2028: agg.a2028,
    answered2028: agg.answered2028,
    counts2023: agg.v2023,
    total2023: agg.total2023,
    counts2018: agg.v2018,
    total2018: agg.total2018,
    shares2028,
    shares2023,
    shares2018,
    device: agg.device,
    deviceTotal: agg.deviceTotal,
  }), [scopeAcs, agg, shares2028, shares2023, shares2018, selectedAcs, acByNo, group]);

  const lead = useMemo(() => leadingParty(agg.a2028, CONTESTED as unknown as string[]), [agg]);

  const reset = useCallback(() => {
    setGroup(null);
    setSelectedAcs([]);
    setLayer("party");
    setShowLabels(false);
    setResetNonce((n) => n + 1);
  }, []);

  const selectGroup = useCallback((g: string | null) => {
    setGroup(g);
    setSelectedAcs([]);
    setAcFilter("");
  }, []);

  const toggleAc = useCallback((no: number, additive: boolean) => {
    setSelectedAcs((prev) => {
      if (!additive) return prev.length === 1 && prev[0] === no ? [] : [no];
      return prev.includes(no) ? prev.filter((x) => x !== no) : [...prev, no];
    });
  }, []);

  const hoveredAc = hover ? acByNo.get(hover.ac) : null;

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
        <div>
          <h1 className="font-display text-2xl font-semibold">Telangana data unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading Telangana election intelligence…</p>
      </main>
    );
  }

  const groupAcs = group ? groups.find((g) => g.group === group)?.acs ?? [] : [];
  const filteredGroupAcs = groupAcs.filter((a) => !acFilter || a.name.toLowerCase().includes(acFilter.toLowerCase()) || String(a.no) === acFilter);

  const Filters = (
    <div className="space-y-4">
      <div>
        <p className={LABEL}>Analytical district grouping</p>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">AC-derived grouping, not an official district boundary.</p>
        <div className="mt-2 max-h-56 space-y-0.5 overflow-auto pr-1">
          <button type="button" onClick={() => selectGroup(null)}
            className={cn("flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] transition-colors",
              !group ? "bg-saffron/15 font-semibold text-saffron-2" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground")}>
            <span>All Telangana</span>
            <span className="text-[10px]">{data.totals.acs} ACs</span>
          </button>
          {groups.map((g) => {
            const gLead = leadingParty(combineAcs(g.acs).a2028, CONTESTED as unknown as string[]);
            return (
              <button key={g.group} type="button" onClick={() => selectGroup(g.group)}
                className={cn("flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors",
                  group === g.group ? "bg-saffron/15 font-semibold text-saffron-2" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground")}>
                <span className="size-2 shrink-0 rounded-sm" style={{ background: gLead.party ? partyMeta(gLead.party).color : "transparent", border: gLead.party ? "none" : "1px solid var(--border)" }} />
                <span className="truncate">{g.group}</span>
                <span className="ml-auto text-[9.5px] opacity-60">{g.acs.length}</span>
              </button>
            );
          })}
        </div>
      </div>

      {group && (
        <div>
          <p className={LABEL}>Assemblies · multi-select</p>
          <input value={acFilter} onChange={(e) => setAcFilter(e.target.value)} placeholder="Filter assemblies"
            className="mt-1.5 w-full rounded-md border border-border bg-background px-2 py-1 text-[11.5px] outline-none focus-visible:ring-2 focus-visible:ring-saffron/50" />
          <div className="mt-1.5 max-h-52 space-y-0.5 overflow-auto pr-1">
            {filteredGroupAcs.map((a) => {
              const on = selectedAcs.includes(a.no);
              return (
                <button key={a.no} type="button" onClick={(e) => toggleAc(a.no, e.shiftKey || e.metaKey || e.ctrlKey)}
                  className={cn("flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11.5px] transition-colors",
                    on ? "bg-saffron/15 font-semibold text-saffron-2" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground")}>
                  <span className={cn("grid size-3.5 place-items-center rounded border", on ? "border-saffron bg-saffron text-[#241203]" : "border-border")}>
                    {on && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                  <span className="truncate">{a.no}. {a.name}</span>
                  {a.reservation && <span className="ml-auto text-[9px] opacity-60">{a.reservation}</span>}
                </button>
              );
            })}
            {!filteredGroupAcs.length && <p className="px-2 py-2 text-[11px] text-muted-foreground">No assemblies match.</p>}
          </div>
        </div>
      )}

      <div>
        <p className={LABEL}>Map layer</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg border border-border p-0.5">
          {([["party", "Party mix"], ["device", "Device mix"]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setLayer(id)}
              className={cn("flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
                layer === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {id === "party" ? <MapPin className="size-3" /> : <Layers className="size-3" />}{label}
            </button>
          ))}
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11.5px] text-muted-foreground">
          <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="size-3.5 accent-[var(--saffron)]" />
          Show labels
        </label>
      </div>

      <div>
        <p className={LABEL}>Parties</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {CONTESTED.map((p) => {
            const on = parties.includes(p);
            return (
              <button key={p} type="button" onClick={() => setParties((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])}
                aria-pressed={on}
                className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-colors",
                  on ? "border-border bg-card text-foreground" : "border-transparent text-muted-foreground/60")}>
                <span className="size-2 rounded-sm" style={{ background: on ? PARTY_META[p].color : "var(--border)" }} />
                {PARTY_META[p].short}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-background pb-16 text-foreground">
      <div className="mx-auto max-w-[1400px] px-4 pt-24 sm:px-6 lg:px-8">
        {/* header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
              <Link href="/case-studies" className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="size-3" /> Case studies</Link>
              <ChevronRight className="size-3 opacity-50" />
              <button type="button" onClick={() => selectGroup(null)} className={cn("hover:text-foreground", !group && "font-semibold text-foreground")}>Telangana</button>
              {group && <><ChevronRight className="size-3 opacity-50" />
                <button type="button" onClick={() => setSelectedAcs([])} className={cn("truncate hover:text-foreground", !selectedAcs.length && "font-semibold text-foreground")}>{group}</button></>}
              {selectedAcs.length > 0 && <><ChevronRight className="size-3 opacity-50" />
                <span className="truncate font-semibold text-foreground">{selectedAcs.length === 1 ? acByNo.get(selectedAcs[0])?.name : `${selectedAcs.length} assemblies`}</span></>}
            </nav>

            <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
              <h1 className="font-display text-[clamp(28px,3.6vw,44px)] font-semibold leading-none tracking-[-0.03em]">Telangana</h1>
              <span className="rounded-full border border-saffron/40 bg-saffron/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-saffron-2">Survey scenario</span>
            </div>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              Opinion poll · 2028 vote intention · collected {data.surveyCollectionYear} · historical actuals 2018 &amp; 2023
            </p>
          </div>

          <div className="flex shrink-0 items-end gap-3">
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e5007d]/30 bg-[#e5007d]/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#b8005f] dark:text-[#ff8fc4]">
                <span className="size-2 rounded-sm bg-[#e5007d]" /> BRS
              </span>
              <p className="mt-1 text-[9.5px] text-muted-foreground">Supplied portrait</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/telangana/brs-leader.png" alt="BRS leader (user-supplied portrait)" className="h-24 w-auto object-contain" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/telangana/brs-car.png" alt="BRS car symbol (user-supplied asset)" className="h-9 w-auto object-contain opacity-90" />
          </div>
        </header>

        {/* sticky breadcrumb / reset on mobile */}
        <div className="sticky top-[4.5rem] z-20 -mx-4 mt-3 flex items-center gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
          <div className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            <b className="text-foreground">{scope.label}</b>
            {agg.answered2028 > 0 ? <> · {fmtPct(agg.answered2028 ? (lead.share ?? 0) : null)} {lead.party ? partyMeta(lead.party).label : ""} lead</> : <> · No answered survey responses</>}
            {lead.tie.length > 1 && <span className="ml-1 text-amber-600 dark:text-amber-400">(shared lead)</span>}
            {agg.answered2028 > 0 && agg.answered2028 < SMALL_SAMPLE && <span className="ml-1 text-amber-600 dark:text-amber-400">(low sample)</span>}
          </div>
          <button type="button" onClick={reset}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
            <RotateCcw className="size-3" /> Reset View
          </button>
        </div>

        {/* filters + map + rail */}
        <div className="mt-3 grid gap-3 lg:grid-cols-[228px_minmax(0,1fr)_300px]">
          <aside className="hidden lg:block">
            <div className="rounded-2xl border border-border bg-card p-3">
              <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold"><SlidersHorizontal className="size-3.5" /> Filters</div>
              {Filters}
            </div>
          </aside>

          <div className="min-w-0">
            <details className="mb-2 rounded-xl border border-border bg-card lg:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[12px] font-semibold [&::-webkit-details-marker]:hidden">
                <SlidersHorizontal className="size-3.5" /> Filters
                <span className="ml-auto text-[10px] font-normal text-muted-foreground">{scope.label}</span>
              </summary>
              <div className="border-t border-border px-3 py-3">{Filters}</div>
            </details>

            <div className="h-[380px] sm:h-[460px] lg:h-[560px]">
              <TelanganaMap
                acs={data.acs}
                theme={(theme === "light" ? "light" : "dark") as MapTheme}
                group={group}
                selectedAcs={selectedAcs}
                layer={layer}
                showLabels={showLabels}
                onSelectGroup={selectGroup}
                onToggleAc={toggleAc}
                onHover={(ac, x, y) => setHover(ac == null ? null : { ac, x, y })}
                resetNonce={resetNonce}
              />
            </div>

            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Fill = leading 2028 survey party; lightness reflects the lead share on a shared scale. Polygon area is not vote volume.
              {group ? " Focus uses the uploaded analytical grouping, not an official district boundary." : " Select a group or assembly to focus."}
            </p>
          </div>

          <aside className="min-w-0">
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={LABEL}>Current scope</p>
                    <h2 className="mt-0.5 font-display text-lg font-semibold leading-tight">{scope.label}</h2>
                    <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                      {scopeAcs.length} assembl{scopeAcs.length === 1 ? "y" : "ies"} · {fmtInt(agg.answered2028)} answered in 2028
                    </p>
                  </div>
                  {lead.party && (
                    <span className="flex items-center gap-1 whitespace-nowrap rounded-full border border-border px-2 py-1 text-[10px] font-semibold">
                      <span className="size-2 rounded-sm" style={{ background: partyMeta(lead.party).color }} />
                      {partyMeta(lead.party).short} lead
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {agg.answered2028 === 0 && <p className="rounded-lg bg-muted/40 px-2 py-2 text-[11px] text-muted-foreground">No answered survey responses in this scope.</p>}
                  {agg.answered2028 > 0 && agg.answered2028 < SMALL_SAMPLE && (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10.5px] text-amber-800 dark:text-amber-300">
                      Low sample: {agg.answered2028} answered rows in this scope. Treat shares as indicative only; nothing is redistributed to improve coverage.
                    </p>
                  )}
                  {shares2028.filter((s) => s.party !== "NOTA" && (s.count > 0 || s.share !== null)).slice(0, 7).map((s) => {
                    const s23 = shares2023.find((x) => x.party === s.party)?.share ?? null;
                    const diff = s.count > 0 && s.share !== null && s23 !== null ? s.share - s23 : null;
                    return (
                      <div key={s.party}>
                        <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
                          <span className="flex items-center gap-1.5 font-medium"><span className="size-2 rounded-sm" style={{ background: partyMeta(s.party).color }} />{partyMeta(s.party).label}</span>
                          <span className="whitespace-nowrap tabular-nums"><b>{s.count === 0 ? "—" : fmtPct(s.share)}</b>
                            {diff !== null && <span className={cn("ml-1 text-[10px]", diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{fmtPp(diff, 1)}</span>}
                          </span>
                        </div>
                        <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-muted/40">
                          <div className="h-full rounded" style={{ width: `${Math.max(0.5, s.share ?? 0)}%`, background: partyMeta(s.party).color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {agg.answered2028 > 0 && <p className="mt-2 text-[9.5px] leading-snug text-muted-foreground">Difference is survey vs actual 2023, not a measured swing.</p>}
              </div>

              {selectedAcs.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <p className={LABEL}>Selected assemblies</p>
                    <button type="button" onClick={() => setSelectedAcs([])} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {selectedAcs.map((no) => {
                      const a = acByNo.get(no);
                      return (
                        <span key={no} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10.5px]">
                          {a?.name ?? no}
                          <button type="button" aria-label={`Remove ${a?.name ?? no}`} onClick={() => toggleAc(no, false)} className="text-muted-foreground hover:text-foreground">
                            <X className="size-2.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[9.5px] text-muted-foreground">Counts are summed before shares are calculated — never an average of AC percentages.</p>
                </div>
              )}

              <div className="rounded-2xl border border-border bg-card p-3">
                <p className={LABEL}>Historical actuals</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="text-muted-foreground">2018 total votes</p>
                    <p className="font-semibold tabular-nums">{fmtInt(agg.total2018)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">2023 total votes</p>
                    <p className="font-semibold tabular-nums">{fmtInt(agg.total2023)}</p>
                  </div>
                </div>
                <p className="mt-1.5 text-[9.5px] leading-snug text-muted-foreground">Candidate votes + NOTA in the same scope. Actual results are visually distinct from the survey series.</p>
              </div>
            </div>
          </aside>
        </div>

        <TelanganaCharts scope={scope} age={data.age} rounds={data.rounds} chart={chart} onChart={setChart} />

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <AboutTelangana
            totals={data.totals}
            conflictRows={data.totals.conflictRows}
            sourceEntries={data.totals.sourceEntries}
            groups={data.totals.groups}
            acs={data.totals.acs}
          />
          <div className="rounded-2xl border border-border bg-card p-4 text-[11px] text-muted-foreground">
            <p className={LABEL}>Method notes</p>
            <ul className="mt-2 space-y-1.5">
              <li>· 2018 and 2023 are actual results; 2028 is a survey scenario.</li>
              <li>· Zero denominator shows “No answered survey responses”, never 0%.</li>
              <li>· Missing ages and blank answers are retained, not redistributed.</li>
              <li>· Device markers are assembly aggregates, not handset locations.</li>
              <li>· No seat projection, confidence interval or ad-performance claim.</li>
            </ul>
            {data.importVersion && <p className="mt-2 break-all text-[9.5px]">Active import: {data.importVersion.slice(0, 8)}…</p>}
          </div>
        </div>
      </div>

      {/* hover tooltip */}
      {hover && hoveredAc && (
        <div
          className="pointer-events-none fixed z-50 w-56 rounded-xl border border-border bg-card/95 p-2.5 text-[11px] shadow-xl backdrop-blur"
          style={{ left: Math.min(hover.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1200) - 236), top: Math.min(hover.y + 14, (typeof window !== "undefined" ? window.innerHeight : 800) - 150) }}
        >
          <p className="font-display text-[12px] font-semibold">{hoveredAc.no}. {hoveredAc.name}</p>
          <p className="text-[10px] text-muted-foreground">{hoveredAc.group}{hoveredAc.reservation ? ` · ${hoveredAc.reservation}` : ""}</p>
          {hoveredAc.answered2028 > 0 ? (
            (() => {
              const l = leadingParty(hoveredAc.a2028, CONTESTED as unknown as string[]);
              return (
                <div className="mt-1.5 space-y-0.5">
                  <p className="flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: l.party ? partyMeta(l.party).color : "var(--border)" }} />
                    <b>{l.party ? partyMeta(l.party).label : "—"}</b> <span className="tabular-nums">{fmtPct(l.share)}</span>
                    {l.tie.length > 1 && <span className="text-[9px] text-amber-600 dark:text-amber-400">shared lead</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{fmtInt(hoveredAc.answered2028)} answered 2028 · {fmtInt(hoveredAc.scenarioRows)} scenario rows</p>
                  {hoveredAc.answered2028 < SMALL_SAMPLE && (
                    <p className="text-[9.5px] font-medium text-amber-700 dark:text-amber-400">Low sample — indicative only</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">2023 lead share: {fmtPct((() => { const t = Object.values(hoveredAc.v2023).reduce((s, n) => s + n, 0); return t ? ((hoveredAc.v2023[l.party ?? ""] ?? 0) / t) * 100 : null; })())}</p>
                </div>
              );
            })()
          ) : (
            <p className="mt-1.5 text-[10.5px] text-muted-foreground">No answered survey responses</p>
          )}
          <p className="mt-1 text-[9px] text-muted-foreground">Click to {group ? "add this assembly" : "focus its group"}.</p>
        </div>
      )}
    </main>
  );
}
