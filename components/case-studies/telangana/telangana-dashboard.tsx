"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Check, ChevronDown, Layers, MapPin, RotateCcw, Search } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { PARTIES, PARTY_COLOR, PARTY_LABEL, NO_DATA_COLOR, leaderOf, partyShade, rawShares, weightedShares, type Oct26, type ShareSet } from "@/lib/telangana/oct26";
import TelanganaRail, { type ScopeResult } from "./telangana-rail";
import AboutTelangana from "./about-telangana";
import type { MapTheme } from "./telangana-map";

const TelanganaMap = dynamic(() => import("./telangana-map"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading Telangana…</div>,
});

type Tab = "change" | "share" | "seats" | "more";
type Layer = "party";

const LABEL = "text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";

/* ---------------- searchable single-select ---------------- */
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
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card/80 px-2.5 py-2 text-left text-[12px] backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60",
          disabled ? "cursor-not-allowed opacity-50" : "hover:border-saffron/40",
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          <div className="flex items-center gap-1.5 border-b border-border px-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={input}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={(e) => {
                if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
                else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(filtered.length - 1, i + 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
                else if (e.key === "Enter") { e.preventDefault(); if (filtered[active]) choose(filtered[active]); }
              }}
              placeholder="Search…"
              aria-label={`Search ${label.toLowerCase()}`}
              className="w-full bg-transparent py-2 text-[12px] outline-none placeholder:text-muted-foreground/70"
            />
          </div>
          <ul role="listbox" aria-label={label} className="max-h-56 overflow-y-auto py-1 [scrollbar-width:thin]">
            {filtered.map((o, i) => (
              <li key={o.value || "all"} role="option" aria-selected={o.value === value}>
                <button
                  type="button"
                  onClick={() => choose(o)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px]",
                    i === active ? "bg-muted/50" : "",
                    o.value === value ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
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

/* ---------------- dashboard ---------------- */
export default function TelanganaDashboard() {
  const { theme } = useTheme();
  const [data, setData] = useState<Oct26 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [district, setDistrict] = useState<string | null>(null);
  const [acNo, setAcNo] = useState<number | null>(null);
  const [series, setSeries] = useState<"prediction" | "raw">("prediction");
  const [tab, setTab] = useState<Tab>("change");
  const [full, setFull] = useState(false);

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

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [full]);

  const acs = data?.acs ?? [];
  const acByNo = useMemo(() => new Map(acs.map((a) => [a.no, a])), [acs]);
  const currentAc = acNo != null ? acByNo.get(acNo) ?? null : null;

  const districts = useMemo(() => data?.districts ?? [], [data]);
  const districtOptions = useMemo<Option[]>(
    () => [{ value: "", label: "All Telangana" }, ...districts.map((d) => ({ value: d.name, label: d.name, hint: `${d.acs.length} ACs` }))],
    [districts],
  );
  const assemblyPool = useMemo(
    () => (district ? acs.filter((a) => a.district === district) : acs),
    [acs, district],
  );
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
    const empty: ShareSet = { BRS: 0, Congress: 0, BJP: 0, Others: 0 };
    if (!scopeAcs.length) {
      return { label: district ?? "Statewide", actual: empty, prediction: empty, raw: empty, answered: 0, votes2023: 0, leader: null, tied: [], marginPp: 0 };
    }
    const actual = weightedShares(scopeAcs, "actual");
    const prediction = weightedShares(scopeAcs, "prediction");
    const raw = rawShares(scopeAcs);
    const shown = series === "prediction" ? prediction : raw;
    const lead = leaderOf(shown);
    return {
      label: currentAc ? currentAc.name : district ?? "Telangana",
      actual, prediction, raw,
      answered: scopeAcs.reduce((n, a) => n + a.answered2028, 0),
      votes2023: scopeAcs.reduce((n, a) => n + (a.votes2023 || 0), 0),
      leader: lead.leader, tied: lead.tied, marginPp: lead.marginPp,
    };
  }, [scopeAcs, series, currentAc, district]);

  if (error && !data) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
        <div>
          <h1 className="font-display text-2xl font-semibold">Telangana data unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)}
            className="mt-4 rounded-full border border-border px-4 py-1.5 text-[12px] font-semibold hover:border-saffron/50">
            Try again
          </button>
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
        {/* compact controls */}
        <aside aria-label="Map controls" className="relative z-30 lg:absolute lg:left-8 lg:top-24 lg:w-[264px] lg:max-h-[calc(100svh-7rem)] lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]">
          <Link href="/case-studies"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-[12.5px] text-muted-foreground backdrop-blur-xl transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
            <ArrowLeft className="size-3.5" /> Back to Case Studies
          </Link>

          <h1 className="mt-4 font-display text-[clamp(34px,4vw,52px)] font-semibold leading-[0.98] tracking-[-0.03em]">Telangana</h1>
          <p className="mt-2 text-[13px] font-semibold text-foreground/70">Election intelligence</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">2028 vote intention across 119 assemblies</p>

          <div className="mt-6 space-y-3">
            <SearchSelect
              label="District"
              value={district ?? ""}
              options={districtOptions}
              placeholder="Select a district"
              onChange={(v) => selectDistrict(v || null)}
            />
            <SearchSelect
              label="Assembly"
              value={acNo != null ? String(acNo) : ""}
              options={assemblyOptions}
              placeholder="Select an assembly"
              onChange={(v) => selectAc(v ? Number(v) : null)}
            />

            <div>
              <span className={LABEL}>Map layer</span>
              <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-border p-0.5">
                <button type="button" aria-pressed
                  className="flex items-center justify-center gap-1 rounded-md bg-foreground px-2 py-1.5 text-[11px] font-medium text-background">
                  <MapPin className="size-3" /> Party mix
                </button>
                <button type="button" disabled aria-disabled="true" title="Device metadata is not included in this workbook"
                  className="flex cursor-not-allowed items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-muted-foreground/45">
                  <Layers className="size-3" /> Devices
                </button>
              </div>
              <p className="mt-1 text-[9.5px] leading-snug text-muted-foreground">Device data is not included in this workbook.</p>
            </div>

            <div>
              <span className={LABEL}>Leading party</span>
              <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-medium text-muted-foreground">
                {PARTIES.map((p) => (
                  <span key={p} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-5 shrink-0 rounded-[2px] ring-1 ring-inset ring-black/15"
                      style={{ background: `linear-gradient(90deg, ${partyShade(p, 0.2)} 0%, ${PARTY_COLOR[p]} 50%, ${partyShade(p, 0.7)} 100%)` }} />
                    {PARTY_LABEL[p]}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-5 shrink-0 rounded-[2px] ring-1 ring-inset ring-black/15"
                    style={{ background: `linear-gradient(90deg, ${PARTY_COLOR.BRS} 0 50%, ${PARTY_COLOR.Congress} 50% 100%)` }} />
                  Tie
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-5 shrink-0 rounded-[2px] ring-1 ring-inset ring-black/15" style={{ background: NO_DATA_COLOR }} />
                  No data
                </span>
              </div>
              <p className="mt-1.5 text-[9px] leading-snug text-muted-foreground">Shade = predicted share · lighter lower, darker higher</p>
            </div>
          </div>
        </aside>

        {/* map */}
        <div className="relative z-0 mt-4 h-[52svh] min-h-[360px] overflow-hidden rounded-2xl border border-border bg-card lg:absolute lg:inset-x-0 lg:top-16 lg:bottom-0 lg:mt-0 lg:h-auto lg:rounded-none lg:border-0 lg:bg-transparent">
          <TelanganaMap
            acs={acs}
            district={district}
            ac={acNo}
            theme={(theme === "light" ? "light" : "dark") as MapTheme}
            onSelectDistrict={selectDistrict}
            onSelectAc={selectAc}
            onReset={reset}
          />
          {(district || currentAc) && (
            <button type="button" onClick={reset}
              className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 text-[11px] font-semibold shadow-sm backdrop-blur transition-colors hover:border-saffron/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60 lg:left-[312px]">
              <RotateCcw className="size-3" /> Reset
            </button>
          )}
        </div>

        {/* comparison rail */}
        <section className={cn("relative mx-auto mt-4 max-w-xl lg:absolute lg:right-6 lg:top-24 lg:mt-0 lg:w-[340px] lg:max-w-none lg:max-h-[calc(100svh-7rem)] lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]", full ? "z-[90]" : "z-20")}>
          <TelanganaRail
            scope={scope}
            series={series}
            onSeries={setSeries}
            tab={tab}
            onTab={setTab}
            full={full}
            onFull={() => setFull((v) => !v)}
            theme={theme === "light" ? "light" : "dark"}
            statewideLeads={data.statewide.leads}
            isStatewide={isStatewide}
          />
        </section>
      </section>

      <AboutTelangana data={data} />
    </div>
  );
}
