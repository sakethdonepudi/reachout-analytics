"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Check, ChevronDown, RotateCcw, Search } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import {
  NO_DATA_COLOR, PARTIES, PARTY_COLOR, PARTY_LABEL, leaderOf, shadeHex, weightedShares,
  type Oct26, type ShareSet,
} from "@/lib/telangana/oct26";
import {
  ELECTION_YEARS, YEAR_LABEL, baselineYear, deviceSummary, historicalAc, historicalShares,
  historicalTotal, winnerColour, winnerLabel, winnerSeats, type ElectionYear,
} from "@/lib/telangana/history";
import TelanganaRail, { type ScopeResult } from "./telangana-rail";
import AboutTelangana from "./about-telangana";
import type { MapTheme } from "./telangana-map";

const TelanganaMap = dynamic(() => import("./telangana-map"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading Telangana…</div>,
});
const TelanganaAnalysis = dynamic(() => import("./telangana-analysis"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-[140] grid place-items-center bg-background/80 text-sm text-muted-foreground backdrop-blur-sm">Opening analysis…</div>,
});

type Tab = "change" | "share" | "seats";

const LABEL = "text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";

type Option = { value: string; label: string; hint?: string };

function SearchSelect({
  label, value, options, placeholder, onChange, disabled,
}: {
  label: string;
  value: string;
  options: Option[];
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) { setQuery(""); setActive(0); requestAnimationFrame(() => input.current?.focus()); }
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q) || (o.hint ?? "").toLowerCase().includes(q))
    : options;

  const choose = (o: Option) => { onChange(o.value); setOpen(false); };

  return (
    <div ref={root} className="relative">
      <span className={LABEL}>{label}</span>
      <button type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn("mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card/80 px-2.5 py-2 text-left text-[12px] backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60",
          disabled ? "cursor-not-allowed opacity-50" : "hover:border-saffron/40")}>
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          <div className="flex items-center gap-1.5 border-b border-border px-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input ref={input} value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
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
                  className={cn("flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px]", i === active ? "bg-muted/50" : "",
                    o.value === value ? "font-semibold text-foreground" : "text-muted-foreground")}>
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

export default function TelanganaDashboard() {
  const { theme } = useTheme();
  const [data, setData] = useState<Oct26 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [district, setDistrict] = useState<string | null>(null);
  const [acNo, setAcNo] = useState<number | null>(null);
  const [year, setYear] = useState<ElectionYear>("2028");
  const [tab, setTab] = useState<Tab>("change");
  const [chartOpen, setChartOpen] = useState(false);
  const expandFocus = useRef<HTMLElement | null>(null);
  const openAnalysis = useCallback(() => {
    expandFocus.current = document.activeElement as HTMLElement | null;
    setChartOpen(true);
  }, []);
  const closeAnalysis = useCallback(() => {
    setChartOpen(false);
    requestAnimationFrame(() => expandFocus.current?.focus());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setError(null);
    fetch("/api/public/case-studies/telangana/aggregates", { cache: "no-store", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Oct26) => { if (!cancelled) setData(d); })
      .catch((e) => {
        if (cancelled || (e as Error)?.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Could not load Telangana data");
      });
    return () => { cancelled = true; controller.abort(); };
  }, [reloadKey]);

  const acs = data?.acs ?? [];
  const acByNo = useMemo(() => new Map(acs.map((a) => [a.no, a])), [acs]);
  const currentAc = acNo != null ? acByNo.get(acNo) ?? null : null;

  const districts = useMemo(() => data?.districts ?? [], [data]);
  const districtOptions = useMemo<Option[]>(
    () => [{ value: "", label: "All Telangana" }, ...districts.map((d) => ({ value: d.name, label: d.name, hint: `${d.acs.length} ACs` }))],
    [districts],
  );
  const assemblyPool = useMemo(() => (district ? acs.filter((a) => a.district === district) : acs), [acs, district]);
  const assemblyOptions = useMemo<Option[]>(
    () => [
      { value: "", label: district ? `All assemblies in ${district}` : "All assemblies" },
      ...assemblyPool.map((a) => ({ value: String(a.no), label: `${a.no}. ${a.name}`, hint: district ? undefined : a.district })),
    ],
    [assemblyPool, district],
  );

  const selectDistrict = useCallback((name: string | null) => { setDistrict(name); setAcNo(null); }, []);
  const selectAc = useCallback((no: number | null) => {
    if (no == null) { setAcNo(null); return; }
    const a = acByNo.get(no);
    if (a) { setDistrict(a.district); setAcNo(no); }
  }, [acByNo]);
  const reset = useCallback(() => { setDistrict(null); setAcNo(null); }, []);

  const scopeAcs = useMemo(() => {
    if (!data) return [];
    if (currentAc) return [currentAc];
    if (district) return data.acs.filter((a) => a.district === district);
    return data.acs;
  }, [data, district, currentAc]);

  const scope: ScopeResult = useMemo(() => {
    const empty: ShareSet = { BRS: 0, Congress: 0, BJP: 0, AIMIM: 0, Others: 0 };
    const label = currentAc ? currentAc.name : district ?? "Telangana";
    if (!scopeAcs.length) {
      return {
        label, baselineYear: baselineYear(year), baseline: empty, prediction: empty,
        change: { ...empty }, predictedLeader: null, predictedTied: [], votes: 0, answered: 0, baselineTotal: 0,
      };
    }
    const prediction = weightedShares(scopeAcs, "prediction");
    const baseYear = baselineYear(year);
    const baseline = historicalShares(scopeAcs, baseYear);
    const change: ShareSet = { BRS: 0, Congress: 0, BJP: 0, AIMIM: 0, Others: 0 };
    for (const p of PARTIES) change[p] = (prediction[p] - baseline[p]) * 100;
    const lead = leaderOf(prediction);
    return {
      label,
      baselineYear: baseYear,
      baseline,
      prediction,
      change,
      predictedLeader: lead.leader,
      predictedTied: lead.tied,
      votes: scopeAcs.reduce((n, a) => n + (a.votes2023 || 0), 0),
      answered: scopeAcs.reduce((n, a) => n + a.answered2028, 0),
      baselineTotal: historicalTotal(scopeAcs, baseYear),
    };
  }, [scopeAcs, year, currentAc, district]);

  const leads2028 = useMemo(() => {
    const out: Record<string, number> = {};
    for (const a of scopeAcs) {
      const lead = leaderOf(a.prediction);
      const key = lead.tied.length > 1 ? "Tie" : lead.leader ?? "Tie";
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  }, [scopeAcs]);
  const actualSeats = useMemo(() => winnerSeats(scopeAcs, baselineYear(year)), [scopeAcs, year]);
  const actualSeatsYear = baselineYear(year);
  const legendItems = useMemo(() => {
    if (year === "2028") {
      return [
        ...PARTIES.map((party) => ({ key: party, label: PARTY_LABEL[party], colour: PARTY_COLOR[party], split: false })),
        { key: "tie", label: "Tie", colour: PARTY_COLOR.BRS, split: true },
        { key: "none", label: "No data", colour: NO_DATA_COLOR, split: false },
      ];
    }
    const counts = new Map<string, number>();
    for (const a of scopeAcs) {
      const rec = historicalAc(year, a.no);
      if (rec) counts.set(rec.winnerParty, (counts.get(rec.winnerParty) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([party]) => ({
      key: party, label: winnerLabel(party), colour: winnerColour(party), split: false,
    }));
  }, [year, scopeAcs]);

  if (error && !data) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
        <div>
          <h1 className="font-display text-2xl font-semibold">Telangana data unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)}
            className="mt-4 rounded-full border border-border px-4 py-1.5 text-[12px] font-semibold hover:border-saffron/50">Try again</button>
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

  const isStatewide = !district && !currentAc;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_18%_8%,rgba(229,0,125,0.055),transparent_60%)]" aria-hidden />

      <section className="relative isolate mx-auto max-w-[1720px] px-4 pb-4 pt-24 sm:pt-28 lg:h-[100svh] lg:min-h-[760px] lg:overflow-hidden lg:px-6 lg:pt-20">
        <aside aria-label="Map controls" className="relative z-30 lg:absolute lg:left-8 lg:top-24 lg:w-[264px] lg:max-h-[calc(100svh-7rem)] lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]">
          <Link href="/case-studies"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-[12.5px] text-muted-foreground backdrop-blur-xl transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
            <ArrowLeft className="size-3.5" /> Back to Case Studies
          </Link>

          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Telangana</p>
          <h1 className="mt-1 font-display text-[clamp(27px,3.2vw,40px)] font-semibold leading-[1.02] tracking-[-0.03em]">ReachOut&apos;s Election Intelligence</h1>

          <div className="mt-5 space-y-3">
            <div>
              <span className={LABEL}>Election year</span>
              <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-border p-0.5" role="group" aria-label="Election year">
                {ELECTION_YEARS.map((y) => (
                  <button key={y} type="button" aria-pressed={year === y} onClick={() => setYear(y)}
                    className={cn("rounded-md px-2 py-1.5 text-[10.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60",
                      year === y ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                    {YEAR_LABEL[y]}
                  </button>
                ))}
              </div>
            </div>

            <SearchSelect label="District" value={district ?? ""} options={districtOptions} placeholder="Select a district"
              onChange={(v) => selectDistrict(v || null)} />
            <SearchSelect label="Assembly" value={acNo != null ? String(acNo) : ""} options={assemblyOptions} placeholder="Select an assembly"
              onChange={(v) => selectAc(v ? Number(v) : null)} />

            <div>
              <span className={LABEL}>{year === "2028" ? "Leading party" : `${YEAR_LABEL[year]} winners`}</span>
              <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[9.5px] font-medium text-muted-foreground">
                {legendItems.map((item) => (
                  <span key={item.key} className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2.5 w-5 shrink-0 rounded-[2px] ring-1 ring-inset ring-black/15"
                      style={{ background: item.split ? `linear-gradient(90deg, ${PARTY_COLOR.BRS} 0 50%, ${PARTY_COLOR.Congress} 50% 100%)` : item.key === "none" ? NO_DATA_COLOR : `linear-gradient(90deg, ${shadeHex(item.colour, 0.2)} 0%, ${item.colour} 50%, ${shadeHex(item.colour, 0.7)} 100%)` }} />
                    <span className="truncate">{item.label}</span>
                  </span>
                ))}
              </div>

            </div>
          </div>
        </aside>

        <div className="relative z-0 mt-4 h-[52svh] min-h-[360px] overflow-hidden rounded-2xl border border-border bg-card lg:absolute lg:inset-x-0 lg:top-16 lg:bottom-0 lg:mt-0 lg:h-auto lg:rounded-none lg:border-0 lg:bg-transparent">
          <TelanganaMap acs={acs} district={district} ac={acNo} year={year} layer="party"
            theme={(theme === "light" ? "light" : "dark") as MapTheme}
            onSelectDistrict={selectDistrict} onSelectAc={selectAc} onReset={reset} />
          {(district || currentAc) && (
            <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 lg:left-[312px]">
              <button type="button" onClick={reset}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card/90 px-3 py-1.5 text-[11px] font-semibold shadow-sm backdrop-blur transition-colors hover:border-saffron/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
                <ArrowLeft className="size-3" /> Telangana
              </button>
              <button type="button" onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 text-[11px] font-semibold shadow-sm backdrop-blur transition-colors hover:border-saffron/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
                <RotateCcw className="size-3" /> Reset
              </button>
            </div>
          )}
        </div>

        <section className="relative z-20 mx-auto mt-4 max-w-xl lg:absolute lg:right-6 lg:top-24 lg:mt-0 lg:w-[340px] lg:max-w-none lg:max-h-[calc(100svh-7rem)] lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]">
          <TelanganaRail scope={scope} year={year} tab={tab} onTab={setTab} onExpand={openAnalysis}
            theme={theme === "light" ? "light" : "dark"} leads2028={leads2028} actualSeats={actualSeats} actualSeatsYear={actualSeatsYear} isStatewide={isStatewide} />
        </section>
      </section>

      <AboutTelangana data={data} />

      {chartOpen && (
        <TelanganaAnalysis open={chartOpen} onClose={closeAnalysis} acs={data.acs} districts={data.districts}
          initialScope={currentAc ? `a:${currentAc.no}` : district ? `d:${district}` : "state"}
          initialLabel={scope.label} theme={theme === "light" ? "light" : "dark"} onSelectDistrict={selectDistrict} />
      )}
    </div>
  );
}
