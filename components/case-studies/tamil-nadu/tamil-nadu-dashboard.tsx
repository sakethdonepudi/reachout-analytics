"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Check, ChevronDown, RotateCcw, Search } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import {
  TN_COLOR, TN_GROUPS, TN_SURVEY_GROUPS, TN_LABEL, TN_SEAT_GROUPS, TN_NO_DATA, tnLeader, tnPct, type TnAggregates, type TnGroup, type TnSeatGroup, type TnShares, type TnYear, type TnYearOrCurrent,
} from "@/lib/tamil-nadu/model";
import TamilNaduRail, { type TnScopeResult, type TnTab } from "./tamil-nadu-rail";
import AboutTamilNadu from "./about-tamil-nadu";
import type { MapTheme } from "./tamil-nadu-map";

const TamilNaduMap = dynamic(() => import("./tamil-nadu-map"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading Tamil Nadu…</div>,
});
const TamilNaduAnalysis = dynamic(() => import("./tamil-nadu-analysis"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-[140] grid place-items-center bg-background/80 text-sm text-muted-foreground backdrop-blur-sm">Opening analysis…</div>,
});

type Option = { value: string; label: string; hint?: string };
const LABEL = "text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";
const YEARS: { id: TnYearOrCurrent; label: string }[] = [
  { id: "2011", label: "2011" }, { id: "2016", label: "2016" }, { id: "2021", label: "2021" }, { id: "2026", label: "2026" },
];

function SearchSelect({ label, value, options, placeholder, onChange, disabled = false }: {
  label: string; value: string; options: Option[]; placeholder: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  useEffect(() => { if (open) { setQuery(""); setActive(0); requestAnimationFrame(() => input.current?.focus()); } }, [open]);
  const selected = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q) || (o.hint ?? "").toLowerCase().includes(q)) : options;
  const choose = (o: Option) => { onChange(o.value); setOpen(false); };
  return (
    <div ref={root} className="relative">
      <span className={LABEL}>{label}</span>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen((v) => !v)}
        className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card/80 px-2.5 py-2 text-left text-[12px] backdrop-blur transition-colors hover:border-saffron/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60 disabled:cursor-not-allowed disabled:opacity-55">
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          <div className="flex items-center gap-1.5 border-b border-border px-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input ref={input} value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={(e) => {
                if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
                else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(filtered.length - 1, i + 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
                else if (e.key === "Enter") { e.preventDefault(); if (filtered[active]) choose(filtered[active]); }
              }}
              placeholder="Search…" aria-label={`Search ${label.toLowerCase()}`}
              className="w-full bg-transparent py-2 text-[12px] outline-none placeholder:text-muted-foreground/70" />
          </div>
          <ul role="listbox" aria-label={label} className="max-h-56 overflow-y-auto py-1 [scrollbar-width:thin]">
            {filtered.map((o, i) => (
              <li key={o.value || "all"} role="option" aria-selected={o.value === value}>
                <button type="button" onClick={() => choose(o)} onMouseEnter={() => setActive(i)}
                  className={cn("flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px]", i === active ? "bg-muted/50" : "", o.value === value ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="shrink-0 text-[9px] uppercase tracking-wide opacity-60">{o.hint}</span>}
                  {o.value === value && <Check className="size-3 shrink-0 text-saffron-2" />}
                </button>
              </li>
            ))}
            {!filtered.length && <li className="px-2.5 py-2 text-[11px] text-muted-foreground">No matches.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function TamilNaduDashboard() {
  const { theme } = useTheme();
  const [data, setData] = useState<TnAggregates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [acNo, setAcNo] = useState<number | null>(null);
  const [year, setYear] = useState<TnYearOrCurrent>("2026");
  const [mode, setMode] = useState<"survey" | "calibrated">("survey");
  const [tab, setTab] = useState<TnTab>("change");
  const [chartOpen, setChartOpen] = useState(false);
  const expandFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/case-studies/tamil-nadu/aggregates", { cache: "no-store", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: TnAggregates) => setData(d))
      .catch((e) => { if ((e as Error)?.name !== "AbortError") setError(e instanceof Error ? e.message : "Could not load Tamil Nadu data"); });
    return () => controller.abort();
  }, []);

  const acs = data?.acs ?? [];
  const districts = data?.districts ?? [];
  const currentAc = acNo != null ? acs.find((a) => a.no === acNo) ?? null : null;
  const currentDistrict = district ? districts.find((d) => d.name === district) ?? null : null;
  const baselineYear: TnYear = year === "2026" ? "2021" : year;
  const baseline = currentAc?.historical[baselineYear] ?? currentDistrict?.historical[baselineYear] ?? data?.statewide.historical[baselineYear] ?? null;
  const currentSurvey = currentAc?.survey ?? currentDistrict?.survey ?? data?.statewide.survey ?? null;
  const emptySeats = TN_SEAT_GROUPS.reduce((o, g) => (o[g] = 0, o), {} as Record<TnSeatGroup, number>);
  const originalSeats = currentAc
    ? { ...emptySeats, ...(currentAc.original.leader ? { [currentAc.original.leader]: 1 } : {}) }
    : currentDistrict?.originalSeats ?? data?.statewide.originalSeats ?? emptySeats;
  const modelSeats = currentAc
    ? { ...emptySeats, ...(currentAc.model.leader ? { [currentAc.model.leader]: 1 } : {}) }
    : currentDistrict?.modelSeats ?? data?.statewide.modelSeats ?? emptySeats;
  const finalSeats = currentAc
    ? { ...emptySeats, ...(currentAc.final.leader ? { [currentAc.final.leader]: 1 } : {}) }
    : currentDistrict?.finalSeats ?? data?.statewide.finalSeats ?? emptySeats;
  const actualSeats = currentAc
    ? { ...emptySeats, ...(currentAc.actual2026.winner ? { [currentAc.actual2026.winner]: 1 } : {}) }
    : currentDistrict?.actualSeats ?? data?.statewide.actualSeats ?? emptySeats;
  const currentLabel = !district && !currentAc ? "survey all responses" : "survey";
  const currentLeader = currentSurvey ? tnLeader(currentSurvey.shares) : null;
  const scopeLabel = currentAc ? currentAc.name : currentDistrict ? currentDistrict.name : "Tamil Nadu";
  const isStatewide = !district && !currentAc;

  const scope = useMemo<TnScopeResult>(() => {
    const b = baseline?.shares ?? {};
    const c = currentSurvey?.shares ?? {};
    const change: TnShares = {};
    for (const g of TN_GROUPS) {
      const present = data?.presence[baselineYear][g] ?? false;
      const bv = b[g];
      const cv = c[g];
      change[g] = present && bv != null && cv != null && (currentSurvey?.valid ?? 0) > 0 ? (cv - bv) * 100 : undefined;
    }
    return {
      label: scopeLabel, baselineYear,
      baseline: b, current: c, change,
      baselineAvailable: !!baseline?.available,
      currentValid: currentSurvey?.valid ?? 0,
      presence: data?.presence ?? { "2011": {}, "2016": {}, "2021": {} } as Record<TnYear, Record<TnGroup, boolean>>,
      originalSeats, modelSeats, finalSeats, actualSeats, currentLabel,
      surveyLeader: currentLeader,
    };
  }, [baseline, baselineYear, currentLeader, currentSurvey, data?.presence, originalSeats, modelSeats, finalSeats, actualSeats, currentLabel, scopeLabel]);

  const districtOptions: Option[] = useMemo(() => [{ value: "", label: "All Tamil Nadu" }, ...districts.map((d) => ({ value: d.name, label: d.name, hint: `${d.acs.length} ACs` }))], [districts]);
  const assemblyOptions: Option[] = useMemo(() => {
    if (!district) return [{ value: "", label: "Select a district first" }];
    const pool = acs.filter((a) => a.district === district);
    return [{ value: "", label: `All assemblies in ${district}` }, ...pool.map((a) => ({ value: String(a.no), label: `${a.no}. ${a.name}` }))];
  }, [acs, district]);

  const selectDistrict = useCallback((name: string | null) => { setDistrict(name); setAcNo(null); }, []);
  const selectAc = useCallback((no: number | null) => {
    if (no == null) { setAcNo(null); return; }
    const a = acs.find((x) => x.no === no);
    if (a) { setDistrict(a.district); setAcNo(no); }
  }, [acs]);
  const reset = useCallback(() => { setDistrict(null); setAcNo(null); }, []);
  const openAnalysis = useCallback(() => { expandFocus.current = document.activeElement as HTMLElement | null; setChartOpen(true); }, []);
  const closeAnalysis = useCallback(() => { setChartOpen(false); requestAnimationFrame(() => expandFocus.current?.focus()); }, []);

  const legend = useMemo(() => {
    if (year === "2026") {
      const active = mode === "calibrated" ? TN_SEAT_GROUPS : TN_SURVEY_GROUPS;
      return active.map((g) => ({ key: g, label: TN_LABEL[g], colour: TN_COLOR[g] }));
    }
    return TN_GROUPS.filter((g) => data?.presence[year][g]).map((g) => ({ key: g, label: TN_LABEL[g], colour: TN_COLOR[g] }));
  }, [year, mode, data?.presence]);

  if (error && !data) {
    return <main className="grid min-h-screen place-items-center bg-background px-6 text-center"><div><h1 className="font-display text-2xl font-semibold">Tamil Nadu data unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p></div></main>;
  }
  if (!data) return <main className="grid min-h-screen place-items-center bg-background"><p className="text-sm text-muted-foreground">Loading Tamil Nadu election intelligence…</p></main>;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_18%_8%,rgba(245,138,36,0.055),transparent_60%)]" aria-hidden />
      <section className="relative isolate mx-auto max-w-[1720px] px-4 pb-4 pt-24 sm:pt-28 lg:h-[100svh] lg:min-h-[760px] lg:overflow-hidden lg:px-6 lg:pt-20">
        <aside aria-label="Map controls" className="relative z-30 lg:absolute lg:left-8 lg:top-24 lg:w-[264px] lg:max-h-[calc(100svh-7rem)] lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]">
          <Link href="/case-studies" className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-[12.5px] text-muted-foreground backdrop-blur-xl transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
            <ArrowLeft className="size-3.5" /> Back to Case Studies
          </Link>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tamil Nadu</p>
          <h1 className="mt-1 font-display text-[clamp(27px,3.2vw,40px)] font-semibold leading-[1.02] tracking-[-0.03em]">ReachOut&apos;s Election Intelligence</h1>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">Assembly election history, the 2026 exit-poll analysis and Actual 2026 seat results. Survey estimates are not official results.</p>
          {isStatewide && <p className="mt-2 inline-flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-full border border-border bg-card/70 px-2.5 py-1 text-[10.5px]"><span><span className="font-semibold uppercase tracking-[0.08em] text-muted-foreground">Survey TVK</span> <b style={{ color: TN_COLOR.TVK }}>{((data.statewide.survey.shares?.TVK ?? 0) * 100).toFixed(2)}%</b></span><span><span className="font-semibold uppercase tracking-[0.08em] text-muted-foreground">Result-calibrated</span> <b style={{ color: TN_COLOR.TVK }}>{((data.statewide.calibrated.shares.TVK ?? 0) * 100).toFixed(2)}%</b></span></p>}
          <div className="mt-5 space-y-3">
            <div>
              <span className={LABEL}>Election year</span>
              <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-border p-0.5" role="group" aria-label="Election year">
                {YEARS.map((y) => <button key={y.id} type="button" aria-pressed={year === y.id} onClick={() => { setYear(y.id); if (y.id !== "2026") setMode("survey"); }} className={cn("rounded-md px-2 py-1.5 text-[10.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60", year === y.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{y.label}</button>)}
              </div>
            </div>
            <div>
              <span className={LABEL}>Map basis</span>
              <div className={cn("mt-1 flex gap-1 rounded-lg border border-border p-0.5", year !== "2026" && "opacity-45")} role="group" aria-label="Map basis">
                {([["survey", "Survey votes"], ["calibrated", "Calibrated calls"]] as const).map(([id, label]) => <button key={id} type="button" disabled={year !== "2026"} aria-pressed={mode === id} onClick={() => setMode(id)} className={cn("flex-1 rounded-md px-1.5 py-1.5 text-[9.5px] font-medium disabled:cursor-not-allowed", mode === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{label}</button>)}
              </div>
            </div>
            <SearchSelect label="District" value={district ?? ""} options={districtOptions} placeholder="Select a district" onChange={(v) => selectDistrict(v || null)} />
            <SearchSelect label="Assembly" value={acNo != null ? String(acNo) : ""} options={assemblyOptions} placeholder={district ? "Select an assembly" : "Select a district first"} disabled={!district} onChange={(v) => selectAc(v ? Number(v) : null)} />
            <div>
              <span className={LABEL}>{year === "2026" ? (mode === "calibrated" ? "2026 calibrated seat calls" : "2026 survey-leading parties") : `${year} group leaders`}</span>
              <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[9.5px] font-medium text-muted-foreground">
                {legend.map((item) => <span key={item.key} className="flex min-w-0 items-center gap-1.5"><span className="h-2.5 w-5 shrink-0 rounded-[2px] ring-1 ring-inset ring-black/15" style={{ background: item.colour }} /><span className="truncate">{item.label}</span></span>)}
                {mode === "survey" && year === "2026" ? <span className="flex min-w-0 items-center gap-1.5"><span className="h-2.5 w-5 shrink-0 rounded-[2px]" style={{ background: TN_NO_DATA }} /><span className="truncate">No data</span></span> : null}
              </div>
            </div>
            {(district || currentAc) && <button type="button" onClick={reset} className="flex w-full items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-left text-[11.5px] font-semibold hover:border-saffron/40"><RotateCcw className="size-3.5" /> Reset to Tamil Nadu</button>}
          </div>
        </aside>

        <div className="relative z-0 mt-4 h-[52svh] min-h-[360px] overflow-hidden rounded-2xl border border-border bg-card lg:absolute lg:inset-x-0 lg:top-16 lg:bottom-0 lg:mt-0 lg:h-auto lg:rounded-none lg:border-0 lg:bg-transparent">
          <TamilNaduMap acs={acs} districts={districts} district={district} acNo={acNo} year={year} mode={mode} theme={(theme === "light" ? "light" : "dark") as MapTheme} onSelectDistrict={selectDistrict} onSelectAc={selectAc} onReset={reset} />
          {year === "2026" && mode === "calibrated" && <div className="absolute bottom-3 left-3 z-20 rounded-full border border-border bg-card/90 px-2.5 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur lg:left-[312px]">Calibrated seat calls · not vote share</div>}
          {(district || currentAc) && (
            <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 lg:left-[312px]">
              <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded-full border border-border bg-card/90 px-3 py-1.5 text-[11px] font-semibold shadow-sm backdrop-blur hover:border-saffron/50"><ArrowLeft className="size-3" /> Tamil Nadu</button>
              <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 text-[11px] font-semibold shadow-sm backdrop-blur hover:border-saffron/50"><RotateCcw className="size-3" /> Reset</button>
            </div>
          )}
        </div>

        <section className="relative z-20 mx-auto mt-4 max-w-xl lg:absolute lg:right-6 lg:top-24 lg:mt-0 lg:w-[340px] lg:max-w-none lg:max-h-[calc(100svh-7rem)] lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]">
          <TamilNaduRail scope={scope} tab={tab} onTab={setTab} onExpand={openAnalysis} theme={theme === "light" ? "light" : "dark"} selectedYear={year} isStatewide={isStatewide} />
        </section>
      </section>

      <AboutTamilNadu data={data} />

      {chartOpen && (
        <TamilNaduAnalysis open={chartOpen} onClose={closeAnalysis} data={data} theme={theme === "light" ? "light" : "dark"}
          initialScope={currentAc ? `a:${currentAc.no}` : district ? `d:${district}` : "state"} defaultBaseline={baselineYear} onSelectDistrict={selectDistrict} onSelectAc={selectAc} />
      )}
    </div>
  );
}
