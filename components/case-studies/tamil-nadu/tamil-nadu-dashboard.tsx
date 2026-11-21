"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Check, ChevronDown, RotateCcw, Search } from "lucide-react";
import PartyCard from "@/components/case-studies/shared/party-card";
import { cn } from "@/lib/utils";
import {
  TN_COLOR, TN_GROUPS, TN_SURVEY_GROUPS, TN_LABEL, TN_SEAT_GROUPS, tnLeader, tnPct, type TnAggregates, type TnGroup, type TnSeatGroup, type TnShares, type TnYear, type TnYearOrCurrent,
} from "@/lib/tamil-nadu/model";
import TamilNaduRail, { type TnScopeResult, type TnTab } from "./tamil-nadu-rail";
import CaseBackLink from "@/components/site/case-back-link";
import CaseStudySplit from "@/components/case-studies/shared/case-study-split";
import type { TnCaseData } from "@/lib/tamil-nadu/view-data";
import type { PollSegment, VoteShareReason } from "@/lib/case-data/types";
import type { MapTheme } from "./tamil-nadu-map";

const TamilNaduMap = dynamic(() => import("./tamil-nadu-map"), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[420px] w-full place-items-center rounded-[10px] border border-[var(--border-hairline)] bg-[var(--surface-panel)] text-[12px] text-muted-foreground">Loading map...</div>,
});
const MemoTamilNaduMap = memo(TamilNaduMap);

const TamilNaduAnalysis = dynamic(() => import("./tamil-nadu-analysis"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-[var(--z-analysis)] grid place-items-center bg-background text-sm text-muted-foreground">Opening analysis…</div>,
});

type Option = { value: string; label: string; hint?: string };
const LABEL = "text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B6B6B]";
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
        className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-[#CFCFCF] bg-white min-h-10 px-2.5 py-2 text-left text-[12px] text-[#0B0B0B] transition-colors hover:border-[#0B0B0B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 disabled:cursor-not-allowed disabled:opacity-55">
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-[var(--z-dropdown)] mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
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
                  className={cn("flex min-h-10 w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px]", i === active ? "bg-muted/50" : "", o.value === value ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="shrink-0 text-[9px] uppercase tracking-wide opacity-60">{o.hint}</span>}
                  {o.value === value && <Check className="size-3 shrink-0 text-teal-deep" />}
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

export default function TamilNaduDashboard({ caseData, aggregates, owner = false, pollType = "opinion", segments = [], reasons = [], initialExpanded = false, initialReason = null }: { caseData: TnCaseData; aggregates: TnAggregates; owner?: boolean; pollType?: "exit" | "opinion"; segments?: PollSegment[]; reasons?: VoteShareReason[]; initialExpanded?: boolean; initialReason?: string | null }) {
  const theme = "light" as const;
  const router = useRouter();
  const pathname = usePathname();
  const opinionPoll = caseData.opinionPoll;
  const data = aggregates;
  const [district, setDistrict] = useState<string | null>(null);
  const [acNo, setAcNo] = useState<number | null>(null);
  const [year, setYear] = useState<TnYearOrCurrent>("2026");
  const [tab, setTab] = useState<TnTab>("share");
  const [fitKey, setFitKey] = useState(0);
  const [chartOpen, setChartOpen] = useState(initialExpanded);
  const expandFocus = useRef<HTMLElement | null>(null);

  useEffect(() => { setChartOpen(initialExpanded); }, [initialExpanded]);

  const acs = data?.acs ?? [];
  const districts = data?.districts ?? [];
  const currentAc = acNo != null ? acs.find((a) => a.no === acNo) ?? null : null;
  const currentDistrict = district ? districts.find((d) => d.name === district) ?? null : null;
  const baselineYear: TnYear = year === "2026" ? "2021" : year;
  const baseline = currentAc?.historical[baselineYear] ?? currentDistrict?.historical[baselineYear] ?? data?.statewide.historical[baselineYear] ?? null;
  const currentSurvey = currentAc?.survey ?? currentDistrict?.survey ?? null;
  const isStatewide = !district && !currentAc;
  const activePollShares = pollType === "exit" ? caseData.exitPoll.shares ?? {} : caseData.opinionPoll.shares ?? {};
  const estimatedShares = isStatewide ? activePollShares : currentSurvey?.shares ?? {};
  const estimatedValid = isStatewide
    ? (pollType === "exit" ? (Object.keys(activePollShares).length ? 1 : 0) : caseData.opinionPoll.denominator ?? 0)
    : currentSurvey?.valid ?? 0;
  const currentLeader = tnLeader(estimatedShares);
  const emptySeats = TN_SEAT_GROUPS.reduce((o, g) => (o[g] = 0, o), {} as Record<TnSeatGroup, number>);
  const opinionSeats = currentAc
    ? emptySeats
    : pollType === "exit"
      ? emptySeats
      : currentDistrict?.originalSeats ?? caseData.opinionPoll.seats ?? data?.statewide.originalSeats ?? emptySeats;
  const opinionCall = pollType === "exit" ? null : currentAc ? currentAc.original?.leader ?? currentAc.surveyLeader ?? null : null;
  const actualSeats = currentAc
    ? { ...emptySeats, ...(currentAc.actual2026.winner ? { [currentAc.actual2026.winner]: 1 } : {}) }
    : currentDistrict?.actualSeats ?? caseData.actual.seats ?? emptySeats;
  const scopeLabel = currentAc ? currentAc.name : currentDistrict ? currentDistrict.name : "Tamil Nadu";

  const scope = useMemo<TnScopeResult>(() => {
    const b = baseline?.shares ?? {};
    const change: TnShares = {};
    for (const g of TN_GROUPS) {
      const present = data?.presence[baselineYear][g] ?? false;
      const bv = b[g];
      const cv = estimatedShares[g];
      change[g] = present && bv != null && cv != null && estimatedValid > 0 ? (cv - bv) * 100 : undefined;
    }
    return {
      label: scopeLabel, baselineYear,
      baseline: b, current: estimatedShares, change,
      baselineAvailable: !!baseline?.available,
      currentValid: estimatedValid,
      presence: data?.presence ?? { "2011": {}, "2016": {}, "2021": {} } as Record<TnYear, Record<TnGroup, boolean>>,
      opinionSeats, opinionCall, actualSeats, currentLabel: pollType === "exit" ? "Exit poll estimate" : "Opinion poll estimate",
      surveyLeader: currentLeader,
    };
  }, [baseline, baselineYear, currentLeader, estimatedShares, estimatedValid, data?.presence, opinionSeats, opinionCall, actualSeats, scopeLabel, pollType]);

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
  const resetToState = useCallback(() => { setDistrict(null); setAcNo(null); }, []);
  const analysisUrl = useCallback((open: boolean) => {
    const params = new URLSearchParams(window.location.search);
    params.set("view", pollType);
    if (open) params.set("expand", "1");
    else { params.delete("expand"); params.delete("reason"); }
    return `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
  }, [pathname, pollType]);
  const openAnalysis = useCallback(() => {
    expandFocus.current = document.activeElement as HTMLElement | null;
    setChartOpen(true);
    router.push(analysisUrl(true), { scroll: false });
  }, [analysisUrl, router]);
  const closeAnalysis = useCallback(() => {
    setChartOpen(false);
    requestAnimationFrame(() => expandFocus.current?.focus());
    router.push(analysisUrl(false), { scroll: false });
  }, [analysisUrl, router]);

  const legend = useMemo(() => {
    if (year === "2026") return TN_SURVEY_GROUPS.map((g) => ({ key: g, label: g === "NOTA" ? "Others & NOTA" : TN_LABEL[g], colour: TN_COLOR[g] }));
    return TN_GROUPS.filter((g) => data?.presence[year][g]).map((g) => ({ key: g, label: TN_LABEL[g], colour: TN_COLOR[g] }));
  }, [year, data?.presence]);

  return (
    <div className="app-chrome relative min-h-0 bg-white text-[var(--p-ink)]">
      <section className="case-study-viewport relative isolate mx-auto max-w-[1720px] px-4 pb-4 pt-0 sm:px-6 xl:flex xl:h-[calc(100svh-9.5rem)] xl:min-h-[600px] xl:flex-col xl:overflow-hidden xl:px-6">
        <CaseStudySplit
          storageKey="tamil-nadu"
          controlsWidth={288}
          defaultPanelWidth={440}
          minPanelWidth={400}
          maxPanelWidth={460}
          minMapWidth={320}
          controlsLabel="Tamil Nadu map controls"
          panelLabel="Tamil Nadu vote-share comparison"
          onResizeEnd={() => setFitKey((key) => key + 1)}
          className="xl:flex-1"
          controls={(
            <div className="relative z-30 lg:min-h-0">
              <CaseBackLink className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#CFCFCF] bg-white px-3 py-1.5 text-[12.5px] text-[#6B6B6B] transition-colors hover:border-[#0B0B0B] hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60">
                <ArrowLeft className="size-3.5" /> Back to Case Studies
              </CaseBackLink>
              <PartyCard party="AIADMK" state="Tamil Nadu" className="mt-4" />
              <div className="mt-5 space-y-3 pb-2">
                <div>
                  <span className={LABEL}>Election year</span>
                  <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-[#E6E6E6] p-0.5" role="group" aria-label="Election year">
                    {YEARS.map((y) => <button key={y.id} type="button" aria-pressed={year === y.id} onClick={() => setYear(y.id)} className={cn("min-h-10 rounded-md px-2 py-1.5 text-[10.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60", year === y.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{y.label}</button>)}
                  </div>
                </div>
                <SearchSelect label="District" value={district ?? ""} options={districtOptions} placeholder="Select a district" onChange={(v) => selectDistrict(v || null)} />
                <SearchSelect label="Assembly" value={acNo != null ? String(acNo) : ""} options={assemblyOptions} placeholder={district ? "Select an assembly" : "Select a district first"} disabled={!district} onChange={(v) => selectAc(v ? Number(v) : null)} />
                {(district || currentAc) && <button type="button" onClick={resetToState} className="flex w-full items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-left text-[11.5px] font-semibold hover:border-teal/40"><RotateCcw className="size-3.5" /> Reset to Tamil Nadu</button>}
                <div>
                  <span className={LABEL}>{year === "2026" ? "Leading party" : `${baselineYear} winners`}</span>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[9.5px] font-medium text-muted-foreground">
                    {legend.map((item) => (
                      <span key={item.key} className="flex min-w-0 items-center gap-1.5">
                        <span className="h-2.5 w-5 shrink-0 rounded-[2px] ring-1 ring-inset ring-black/15" style={{ background: item.colour }} />
                        <span className="truncate">{item.label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          map={(
            <div className="flex h-full min-h-0 flex-col">
              <div className="relative min-h-0 flex-1">
                <MemoTamilNaduMap acs={acs} districts={districts} district={district} acNo={acNo} year={year} theme={(theme === "light" ? "light" : "dark") as MapTheme} fitKey={fitKey} onSelectDistrict={selectDistrict} onSelectAc={selectAc} onReset={resetToState} />
                {(district || currentAc) && (
                  <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 lg:left-3 lg:top-3">
                    <button type="button" onClick={resetToState} className="inline-flex items-center gap-1 rounded-full border border-border bg-[var(--surface-panel)] px-3 py-1.5 text-[11px] font-semibold hover:border-teal/50"><ArrowLeft className="size-3" /> Tamil Nadu</button>
                    <button type="button" onClick={resetToState} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-[var(--surface-panel)] px-3 py-1.5 text-[11px] font-semibold hover:border-teal/50"><RotateCcw className="size-3" /> Reset</button>
                  </div>
                )}
              </div>
            </div>
          )}
          panel={(panelWidth) => (
            <TamilNaduRail scope={scope} tab={tab} onTab={setTab} onExpand={openAnalysis} theme={theme === "light" ? "light" : "dark"} selectedYear={year} isStatewide={isStatewide} opinionPoll={opinionPoll} exitPoll={caseData.exitPoll} actualShares={caseData.actual.shares} panelWidth={panelWidth} owner={owner} pollType={pollType} />
          )}
        />
      </section>


      {chartOpen && (
        <TamilNaduAnalysis open={chartOpen} onClose={closeAnalysis} data={data} theme={theme === "light" ? "light" : "dark"}
          initialScope={currentAc ? `a:${currentAc.no}` : district ? `d:${district}` : "state"} defaultBaseline={baselineYear} onSelectDistrict={selectDistrict} onSelectAc={selectAc} opinionPoll={opinionPoll} exitPoll={caseData.exitPoll} eciActual={caseData.actual} forecasters={caseData.forecasters} forecastActualSeats={caseData.forecastActualSeats} initialTab={tab} owner={owner} pollType={pollType} segments={segments} reasons={reasons} initialReason={initialReason} />
      )}
    </div>
  );
}
