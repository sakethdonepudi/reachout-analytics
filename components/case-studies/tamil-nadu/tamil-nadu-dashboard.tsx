"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, ChevronRight, Layers, Map as MapIcon, MapPin, Navigation, RotateCcw } from "lucide-react";
import {
  PARTY_META, PARTY_ORDER, aggregate, datasetFor, findPincode, rowsForDistricts, STATEWIDE, leadingParty,
  type PollType,
} from "@/lib/data/tamil-nadu-poll-data";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import PollToggle from "./poll-toggle";
import PollSummary from "./poll-summary";
import PollChart from "./poll-chart";
import DistrictFilter from "./district-filter";
import PublishedSummary from "./published-summary";
import ExploreGeography from "./explore-geography";
import SurveyLegend from "./survey-legend";
import type { MapLayers, MapMode } from "./tamil-nadu-map";

const TamilNaduMap = dynamic(() => import("./tamil-nadu-map"), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center text-sm text-muted-foreground">Loading Tamil Nadu…</div>,
});

const MODES: { id: MapMode; title: string; desc: string; Icon: typeof MapIcon }[] = [
  { id: "state", title: "State View", desc: "Entire Tamil Nadu", Icon: MapIcon },
  { id: "district", title: "District View", desc: "Select one or more districts", Icon: MapPin },
  { id: "pincode", title: "PIN Code View", desc: "Explore postal codes", Icon: Navigation },
];

const LAYER_LABELS: { id: keyof MapLayers; label: string }[] = [
  { id: "boundaries", label: "District Boundaries" },
  { id: "pins", label: "PIN Code Markers" },
  { id: "labels", label: "District Labels" },
  { id: "context", label: "Geographic Context" },
];

const LABEL = "text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground";

type PubPin = { pin: string; total: number; valid: number; parties: Record<string, number>; district: string | null; locationAvailable: boolean };

export default function TamilNaduDashboard() {
  const { theme } = useTheme();

  /* ---- one shared geography state: mode + selected regions ---- */
  const [geoMode, setGeoMode] = useState<MapMode>("state");
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [activePincode, setActivePincode] = useState<string | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null); // transient only

  const [pollType, setPollType] = useState<PollType>("exit");
  const [view, setView] = useState<"recorded" | "estimated">("recorded");
  const [layers, setLayers] = useState<MapLayers>({ boundaries: true, pins: true, labels: true, context: false });
  const [pinQuery, setPinQuery] = useState("");
  const [resetNonce, setResetNonce] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const dataset = useMemo(() => datasetFor(pollType), [pollType]);
  const focusDistrict = selectedDistricts.length === 1 ? selectedDistricts[0] : null;
  const activePin = useMemo(() => (activePincode ? findPincode(activePincode, pollType) : undefined), [activePincode, pollType]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(t);
  }, [notice]);

  /* ---- published per-district survey aggregates (live) ---- */
  const [live, setLive] = useState<{ published: boolean; districts: { district: string; total: number; valid: number; parties: Record<string, number> }[]; valid: number; total: number } | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/public/case-studies/tamil-nadu/districts?pollType=${pollType}&basis=${view}`, { cache: "no-store", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setLive(d && d.published ? { published: true, districts: d.districts ?? [], valid: d.valid ?? 0, total: d.total ?? 0 } : { published: false, districts: [], valid: 0, total: 0 });
      })
      .catch(() => { if (!ctrl.signal.aborted) setLive({ published: false, districts: [], valid: 0, total: 0 }); });
    return () => ctrl.abort();
  }, [pollType, view, refreshNonce]);

  /* ---- published per-PIN survey aggregates (live) ---- */
  const [pinData, setPinData] = useState<{ usablePins: number; pins: PubPin[]; message: string | null; withPin: number; withoutPin: number } | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/public/case-studies/tamil-nadu/pins?pollType=${pollType}&basis=${view}`, { cache: "no-store", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setPinData(d && d.published ? { usablePins: d.usablePins ?? 0, pins: d.pins ?? [], message: d.message ?? null, withPin: d.withPin ?? 0, withoutPin: d.withoutPin ?? 0 } : null);
      })
      .catch(() => { if (!ctrl.signal.aborted) setPinData(null); });
    return () => ctrl.abort();
  }, [pollType, view, refreshNonce]);

  // Auto-refresh filters/counts/markers when a new dataset is published
  // (tab focus + visibility + a light poll), matching the districts fetch.
  useEffect(() => {
    const bump = () => setRefreshNonce((n) => n + 1);
    const onVis = () => { if (document.visibilityState === "visible") bump(); };
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(bump, 60000);
    return () => { window.removeEventListener("focus", bump); document.removeEventListener("visibilitychange", onVis); window.clearInterval(id); };
  }, []);

  const intensityActive = !!live?.published;

  /* Five data-driven intensity bands over valid survey responses. */
  const intensity = useMemo(() => {
    if (!live?.published) return null;
    const bands = 5;
    const max = Math.max(0, ...live.districts.map((d) => d.valid));
    const size = max > 0 ? max / bands : 0;
    const bandByName: Record<string, number> = {};
    const liveValid: Record<string, number> = {};
    const liveShare: Record<string, number> = {};
    for (const d of live.districts) {
      bandByName[d.district] = d.valid > 0 && size > 0 ? Math.min(bands - 1, Math.floor((d.valid - 1e-9) / size)) : -1;
      liveValid[d.district] = d.valid;
      liveShare[d.district] = live.valid ? (d.valid / live.valid) * 100 : 0;
    }
    const ranges = max > 0
      ? Array.from({ length: bands }, (_, i) => {
          const lo = i === 0 ? 1 : Math.floor(i * size) + 1;
          const hi = Math.max(lo, Math.floor((i + 1) * size));
          return { lo, hi };
        })
      : [];
    return { bandByName, liveValid, liveShare, ranges, hasData: max > 0 };
  }, [live]);

  const pollLabel = pollType === "exit" ? "Exit Poll" : "Opinion Poll";
  const basisLabel = view === "estimated" ? "Estimated" : "Recorded";

  /* PIN availability comes from the published dataset; the demo path is used
     only when no dataset is published. */
  const publishedPins = intensityActive ? pinData?.pins ?? [] : [];
  const pinDisabled = intensityActive && (pinData ? pinData.usablePins === 0 : true);
  const pinMessage = intensityActive && pinDisabled ? "This uploaded dataset contains no PIN codes" : null;
  const realPin = intensityActive && activePincode ? publishedPins.find((p) => p.pin === activePincode) : undefined;
  const realShares = realPin
    ? Object.entries(realPin.parties)
        .map(([party, count]) => ({ party, count, pct: realPin.valid ? +((count / realPin.valid) * 100).toFixed(2) : 0 }))
        .sort((a, b) => b.count - a.count)
    : [];
  const filteredPublishedPins = (() => {
    const base = focusDistrict ? publishedPins.filter((p) => p.district === focusDistrict) : publishedPins;
    const q = pinQuery.trim();
    return q ? base.filter((p) => p.pin.includes(q)) : base;
  })();

  // District filter rows use live valid counts when published, else demonstration data.
  const allRows = useMemo(() => {
    if (live?.published) {
      const v = new Map(live.districts.map((d) => [d.district, d.valid]));
      return dataset.map((d) => ({ name: d.district, samples: v.get(d.district) ?? 0 }));
    }
    return dataset.map((d) => ({ name: d.district, samples: d.samples }));
  }, [dataset, live]);

  const liveSelection = useMemo(() => {
    if (!live?.published) return null;
    const rows = selectedDistricts.length ? live.districts.filter((d) => selectedDistricts.includes(d.district)) : live.districts;
    const denom = rows.reduce((a, d) => a + d.valid, 0);
    const parties: Record<string, number> = {};
    for (const d of rows) for (const [p, c] of Object.entries(d.parties)) parties[p] = (parties[p] ?? 0) + c;
    const shares = Object.entries(parties)
      .map(([party, count]) => ({ party, count, pct: denom ? +((count / denom) * 100).toFixed(2) : 0 }))
      .sort((a, b) => b.count - a.count);
    return { denom, shares };
  }, [live, selectedDistricts]);

  const headline = useMemo(() => {
    if (activePin) return { samples: activePin.samples, results: activePin.results, scope: `${activePin.district} / ${activePin.pincode}`, chip: "Pincode" };
    if (selectedDistricts.length === 0) {
      const sw = STATEWIDE[pollType];
      return { samples: sw.samples, results: sw.results, scope: "All Tamil Nadu", chip: undefined };
    }
    const agg = aggregate(rowsForDistricts(selectedDistricts, pollType));
    const scope = selectedDistricts.length <= 3 ? selectedDistricts.join(" + ") : `${selectedDistricts.slice(0, 3).join(" + ")} +${selectedDistricts.length - 3}`;
    const chip = selectedDistricts.length > 1 ? `${selectedDistricts.length} districts` : undefined;
    return { ...agg, scope, chip };
  }, [activePin, selectedDistricts, pollType]);

  const votes = useMemo(() => PARTY_ORDER.map((k) => ({ key: k, votes: Math.round((headline.samples * headline.results[k]) / 100) })), [headline]);

  const pinRows = useMemo(() => {
    const rows = focusDistrict ? (dataset.find((d) => d.district === focusDistrict)?.pincodes ?? []) : dataset.flatMap((d) => d.pincodes);
    const q = pinQuery.trim();
    return q ? rows.filter((p) => p.pincode.includes(q)) : rows;
  }, [dataset, focusDistrict, pinQuery]);

  /* ---- geography transitions (single source of truth: geoMode) ---- */
  const applyMode = useCallback((m: MapMode) => {
    setHoveredDistrict(null);
    if (m === "state") { setGeoMode("state"); setSelectedDistricts([]); setActivePincode(null); return; }
    if (m === "district") { setGeoMode("district"); setActivePincode(null); return; }
    // pincode: unavailable without usable PIN codes in the dataset
    if (pinDisabled) { setNotice("This uploaded dataset contains no PIN codes"); return; }
    // retain a single district context, clear the PIN selection
    setGeoMode("pincode");
    setActivePincode(null);
    setSelectedDistricts((prev) => {
      if (prev.length > 1) { setNotice("Kept one district for PIN-code view."); return [prev[0]]; }
      return prev;
    });
  }, [pinDisabled]);

  // If the published dataset has no usable PIN codes, never sit in PIN view.
  useEffect(() => {
    if (pinDisabled && geoMode === "pincode") {
      setGeoMode(selectedDistricts.length ? "district" : "state");
      setActivePincode(null);
      setNotice("This uploaded dataset contains no PIN codes");
    }
  }, [pinDisabled, geoMode, selectedDistricts]);

  const toggleDistrict = useCallback((name: string) => {
    setHoveredDistrict(null);
    setActivePincode(null);
    setSelectedDistricts((prev) => {
      const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name];
      setGeoMode(next.length ? "district" : "state");
      return next;
    });
  }, []);

  const onMapSelectDistrict = useCallback((name: string | null) => {
    setHoveredDistrict(null);
    setActivePincode(null);
    if (name) { setSelectedDistricts([name]); setGeoMode("district"); }
    else { setSelectedDistricts([]); setGeoMode("state"); }
  }, []);

  const onSelectPincode = useCallback((pin: string | null) => {
    setActivePincode(pin);
    if (pin) setGeoMode("pincode");
  }, []);

  const changePollType = (v: PollType) => {
    if (v === pollType) return;
    setPollType(v);
    setHoveredDistrict(null);
    if (activePincode) { setActivePincode(null); setNotice("PIN selection cleared — PIN results differ per poll type."); }
  };

  const changeView = (v: "recorded" | "estimated") => {
    if (v === view) return;
    setView(v);
    setActivePincode(null);
    if (v === "estimated") setNotice("Estimated scenario enabled — allocated districts, not verified respondent locations.");
  };

  const resetView = useCallback(() => {
    setResetNonce((n) => n + 1);
    setGeoMode("state");
    setSelectedDistricts([]);
    setActivePincode(null);
    setHoveredDistrict(null);
    setNotice(null);
  }, []);

  const pinDistrict = realPin?.district ?? activePin?.district ?? focusDistrict;
  const activePinCode = realPin?.pin ?? activePin?.pincode ?? null;
  const crumbs: { label: string; onClick?: () => void }[] = [{ label: "Tamil Nadu", onClick: () => applyMode("state") }];
  if (pinDistrict) crumbs.push({ label: pinDistrict, onClick: () => { setSelectedDistricts([pinDistrict]); setActivePincode(null); setGeoMode("district"); } });
  if (activePinCode) crumbs.push({ label: activePinCode });

  const analysisDistrictPrompt = geoMode === "district" && selectedDistricts.length === 0;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_18%_8%,rgba(245,138,36,0.07),transparent_60%)]" aria-hidden />

      <section className="relative mx-auto max-w-[1720px] px-4 pb-4 pt-24 sm:pt-28 lg:h-[100svh] lg:min-h-[780px] lg:px-6 lg:pt-20">
        {/* title + breadcrumb */}
        <header className="relative z-30 mb-4 max-w-[360px] lg:absolute lg:left-8 lg:top-24 lg:mb-0 lg:max-w-[320px]">
          <Link href="/#tour" className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-[13px] text-muted-foreground backdrop-blur-xl transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
            <ArrowLeft className="size-3.5" /> Back to India Map
          </Link>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-saffron-2">Tamil Nadu · Election Intelligence</p>
          <h1 className="mt-2 font-display text-[clamp(34px,4vw,52px)] font-semibold leading-[0.98] tracking-[-0.03em] text-foreground">Tamil Nadu</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
            <b className="font-bold" style={{ color: PARTY_META.aiadmk.color }}>AIADMK</b>
            <span className="text-muted-foreground">Edappadi K. Palaniswami</span>
          </p>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Constituency, district and pincode-level voter intelligence.</p>
          <nav aria-label="Breadcrumb" className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
            {crumbs.map((c, i) => (
              <span key={c.label + i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="size-3 opacity-50" />}
                {c.onClick ? <button type="button" onClick={c.onClick} className="transition-colors hover:text-foreground focus-visible:outline-none">{c.label}</button> : <span className="font-semibold text-saffron-2">{c.label}</span>}
              </span>
            ))}
          </nav>
        </header>

        {/* left: geography controls (above the map on mobile) */}
        <aside className="relative z-20 mt-4 w-full space-y-2.5 lg:absolute lg:left-8 lg:top-[348px] lg:mt-0 lg:w-[236px] lg:max-h-[calc(100svh-368px)] lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]">
          <ExploreGeography mode={geoMode} onChange={applyMode} pincodeDisabled={pinDisabled} />
          {notice && <p className="rounded-xl border border-saffron/30 bg-saffron/10 px-3 py-2 text-[11px] leading-relaxed text-saffron-2">{notice}</p>}

          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/60 px-3.5 py-2.5">
            <Layers className="size-4 text-saffron-2" />
            <span className={LABEL}>Selected</span>
            <span className="ml-auto font-display text-sm font-semibold tabular-nums text-foreground">{selectedDistricts.length} / {allRows.length}</span>
          </div>
          <button type="button" onClick={resetView}
            className="flex w-full items-center gap-2.5 rounded-2xl border border-border bg-card/60 px-3.5 py-2.5 text-left text-[12px] font-semibold text-foreground transition-colors hover:border-saffron/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
            <RotateCcw className="size-4 text-saffron-2" /> Reset View
          </button>

          <details className="rounded-2xl border border-border bg-card/60 px-3.5 py-2.5" open>
            <summary className={cn("cursor-pointer list-none", LABEL)}>Map Layers</summary>
            <div className="mt-2 space-y-1.5">
              {LAYER_LABELS.map((l) => {
                const on = layers[l.id];
                return (
                  <button key={l.id} type="button" onClick={() => setLayers((s) => ({ ...s, [l.id]: !s[l.id] }))} className="flex w-full items-center gap-2 text-left text-[11.5px] text-foreground/75 transition-colors hover:text-foreground focus-visible:outline-none">
                    <span className={cn("grid size-3.5 shrink-0 place-items-center rounded-[4px] border", on ? "border-saffron bg-saffron" : "border-border")}>
                      {on && <span className="size-1.5 rounded-[1px] bg-[#241203]" />}
                    </span>
                    {l.label}
                  </button>
                );
              })}
            </div>
          </details>

          {intensity && (
            <SurveyLegend theme={theme} ranges={intensity.ranges} hasData={intensity.hasData} pollLabel={pollLabel} basisLabel={basisLabel} className="hidden lg:block" />
          )}
        </aside>

        {/* map */}
        <div className="relative z-0 mt-4 h-[58svh] min-h-[420px] lg:absolute lg:inset-0 lg:mt-0 lg:h-full">
          <TamilNaduMap
            pollType={pollType}
            districts={dataset}
            selectedDistricts={selectedDistricts}
            hoveredDistrict={hoveredDistrict}
            activePincode={activePincode}
            mode={geoMode}
            layers={layers}
            theme={theme}
            intensityActive={intensityActive}
            bandByName={intensity?.bandByName}
            liveValid={intensity?.liveValid}
            liveShare={intensity?.liveShare}
            pollLabel={pollLabel}
            basisLabel={basisLabel}
            resetNonce={resetNonce}
            onHoverDistrict={setHoveredDistrict}
            onSelectDistrict={onMapSelectDistrict}
            onSelectPincode={onSelectPincode}
          />
        </div>

        {/* mobile: legend directly below the map */}
        {intensity && (
          <SurveyLegend theme={theme} ranges={intensity.ranges} hasData={intensity.hasData} pollLabel={pollLabel} basisLabel={basisLabel} className="mt-3 lg:hidden" />
        )}

        {/* right: analysis */}
        <section className="relative z-20 mx-auto mt-4 max-w-xl rounded-2xl border border-border bg-card/85 p-4 shadow-[0_18px_50px_-30px_rgba(15,20,30,0.45)] backdrop-blur-2xl lg:absolute lg:right-[292px] lg:top-24 lg:mt-0 lg:w-[276px] lg:max-w-none">
          <PollToggle value={pollType} onChange={changePollType} />

          <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-border bg-elevated/50 p-1 text-[12px] font-semibold">
            {(["recorded", "estimated"] as const).map((b) => (
              <button key={b} type="button" onClick={() => changeView(b)}
                className={cn("rounded-lg py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60", view === b ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {b === "recorded" ? "Recorded" : "Estimated"}
              </button>
            ))}
          </div>
          {view === "estimated" && (
            <p className="mt-2 text-[10.5px] leading-relaxed text-saffron-2">Includes estimated districts — an allocated scenario, not verified respondent locations.</p>
          )}

          <div className="my-3.5 border-t border-dashed border-border" />

          {geoMode === "pincode" ? (
            pinDisabled ? (
              <p className="py-2 text-[12.5px] leading-relaxed text-muted-foreground">{pinMessage}</p>
            ) : realPin ? (
              <div>
                <p className={LABEL}>PIN code · {realPin.district ?? "district not stated"}</p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <span className="font-display text-2xl font-semibold tabular-nums text-foreground">{realPin.pin}</span>
                  <span className="text-[11.5px] text-muted-foreground">Valid: <b className="tabular-nums text-foreground/85">{realPin.valid.toLocaleString("en-IN")}</b></span>
                </div>
                <ul className="mt-3 space-y-2">
                  {realShares.length === 0 ? (
                    <li className="text-[12px] text-muted-foreground">No valid party responses for this PIN.</li>
                  ) : (
                    realShares.map((s) => (
                      <li key={s.party} className="text-[12px]">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 break-words text-foreground/85">{s.party}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">{s.count.toLocaleString("en-IN")} · {s.pct}%</span>
                        </div>
                        <span className="mt-1 block h-2 overflow-hidden rounded-full bg-elevated"><span className="block h-full rounded-full bg-saffron" style={{ width: `${s.pct}%` }} /></span>
                      </li>
                    ))
                  )}
                </ul>
                <p className="mt-2 text-[10px] leading-relaxed text-saffron-2">
                  {realPin.locationAvailable ? "Marker plotted from the uploaded location reference." : "Map location unavailable — no reliable postal-location reference for this PIN."}
                </p>
              </div>
            ) : activePin ? (
              <div>
                <p className={LABEL}>PIN code · {activePin.district}</p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <span className="font-display text-2xl font-semibold tabular-nums text-foreground">{activePin.pincode}</span>
                  <span className="text-[11.5px] text-muted-foreground">Samples: <b className="tabular-nums text-foreground/85">{activePin.samples.toLocaleString("en-IN")}</b></span>
                </div>
                <p className="mt-1 text-[11.5px] text-muted-foreground">Leading: <b style={{ color: PARTY_META[leadingParty(activePin.results)].color }}>{PARTY_META[leadingParty(activePin.results)].label}</b></p>
                <ul className="mt-3 space-y-1.5">
                  {PARTY_ORDER.map((k) => (
                    <li key={k} className="flex items-center gap-2 text-[11.5px]">
                      <span className="w-14 shrink-0 text-muted-foreground">{PARTY_META[k].label}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
                        <span className="block h-full rounded-full" style={{ width: `${activePin.results[k]}%`, background: PARTY_META[k].color }} />
                      </span>
                      <span className="w-9 text-right tabular-nums text-foreground/85">{activePin.results[k]}%</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Pincode survey areas are visual approximations unless official polygon boundaries are available.</p>
              </div>
            ) : (
              <p className="py-2 text-[12.5px] leading-relaxed text-muted-foreground">Select a PIN code to see its results.</p>
            )
          ) : analysisDistrictPrompt ? (
            <p className="py-2 text-[12.5px] leading-relaxed text-muted-foreground">Select a district to explore.</p>
          ) : intensityActive && liveSelection ? (
            <div>
              <p className={LABEL}>Selected region</p>
              <div className="mt-1 flex items-center gap-2">
                <p className="min-w-0 truncate font-display text-[15px] font-semibold text-foreground">
                  {selectedDistricts.length === 0 ? "All Tamil Nadu" : selectedDistricts.length === 1 ? selectedDistricts[0] : `${selectedDistricts.length} districts`}
                </p>
                <span className="shrink-0 rounded-full border border-[#2fbf4a]/40 bg-[#2fbf4a]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#2fbf4a]">Published</span>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className={LABEL}>Valid responses</p>
                  <p className="font-display text-3xl font-semibold tabular-nums text-foreground">{liveSelection.denom.toLocaleString("en-IN")}</p>
                </div>
                <p className="shrink-0 text-right text-[11px] text-muted-foreground">{pollLabel} · {basisLabel}</p>
              </div>
              <ul className="mt-4 space-y-2.5">
                {liveSelection.shares.length === 0 ? (
                  <li className="text-[12.5px] text-muted-foreground">No data available for this selection.</li>
                ) : (
                  liveSelection.shares.map((s) => (
                    <li key={s.party} className="text-[12.5px]">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 break-words text-foreground/85">{s.party}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{s.count.toLocaleString("en-IN")} · {s.pct}%</span>
                      </div>
                      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-elevated">
                        <span className="block h-full rounded-full bg-saffron" style={{ width: `${s.pct}%` }} />
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : (
            <>
              <PollSummary scope={headline.scope} samples={headline.samples} results={headline.results} chip={headline.chip} />
              <div className="my-3.5 border-t border-dashed border-border" />
              <PollChart results={headline.results} centerLabel={activePin ? "PIN" : undefined} />
              <table className="mt-4 w-full text-[11.5px]">
                <thead>
                  <tr className="text-left text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="pb-1.5 font-semibold">Party</th>
                    <th className="pb-1.5 text-right font-semibold">Votes (est.)</th>
                    <th className="pb-1.5 text-right font-semibold">%</th>
                  </tr>
                </thead>
                <tbody>
                  {votes.map(({ key, votes: v }) => (
                    <tr key={key} className="border-t border-border">
                      <td className="py-1.5">
                        <span className="flex items-center gap-2 text-foreground/80">
                          <span className="size-2 rounded-sm" style={{ background: PARTY_META[key].color }} />
                          {PARTY_META[key].label}
                        </span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-foreground/80">{v.toLocaleString("en-IN")}</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold text-foreground">{headline.results[key]}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {intensityActive ? (
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Published survey data · {pollLabel} · {basisLabel}. Percentages use valid party responses as the denominator.</p>
          ) : (
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">MOCK DATA — vote estimates shown for demonstration only.</p>
          )}
        </section>

        {/* right: filters */}
        <section id="geo-panel" role="region" aria-label="Geography details" className="relative z-20 mx-auto mt-4 flex max-w-xl flex-col rounded-2xl border border-border bg-card/85 p-4 shadow-[0_18px_50px_-30px_rgba(15,20,30,0.45)] backdrop-blur-2xl lg:absolute lg:bottom-8 lg:right-8 lg:top-24 lg:mt-0 lg:w-[240px] lg:max-w-none">
          {geoMode !== "pincode" ? (
            <DistrictFilter
              rows={allRows}
              selected={selectedDistricts}
              onToggle={toggleDistrict}
              onSelectAll={() => applyMode("state")}
              onClear={() => applyMode("state")}
              onHover={setHoveredDistrict}
            />
          ) : pinDisabled ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <p className={cn("mb-2", LABEL)}>{pollLabel} · PIN codes</p>
              <p className="py-2 text-[12.5px] leading-relaxed text-muted-foreground">{pinMessage}</p>
            </div>
          ) : intensityActive ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <p className={cn("mb-3", LABEL)}>
                {focusDistrict ? `${focusDistrict} · ` : "Statewide · "}{filteredPublishedPins.length.toLocaleString("en-IN")} PIN {filteredPublishedPins.length === 1 ? "code" : "codes"}
              </p>
              <label className="relative mb-3 block">
                <input value={pinQuery} onChange={(e) => setPinQuery(e.target.value)} placeholder="Search PIN code..." aria-label="Search PIN codes" className="w-full rounded-xl border border-border bg-elevated/60 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-saffron/60 focus:ring-2 focus:ring-saffron/20" />
              </label>
              <div className="-mr-1 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
                <ul className="space-y-0.5">
                  {filteredPublishedPins.map((p) => {
                    const on = activePincode === p.pin;
                    return (
                      <li key={p.pin}>
                        <button type="button" title={`${p.pin}${p.district ? ` · ${p.district}` : ""}`} aria-pressed={on} onMouseEnter={() => setHoveredDistrict(null)} onClick={() => onSelectPincode(p.pin)}
                          className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60", on ? "bg-saffron/15 text-foreground" : "text-foreground/75 hover:bg-elevated hover:text-foreground")}>
                          <span className="tabular-nums font-medium">{p.pin}</span>
                          {!p.locationAvailable && <span className="rounded border border-border px-1 py-px text-[9px] uppercase tracking-wide text-muted-foreground" title="No reliable map location reference">no map ref</span>}
                          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{p.valid.toLocaleString("en-IN")}</span>
                        </button>
                      </li>
                    );
                  })}
                  {filteredPublishedPins.length === 0 && <li className="px-2 py-6 text-center text-[12.5px] text-muted-foreground">No PIN codes found.</li>}
                </ul>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">From the uploaded responses. Markers appear only where a reliable postal-location reference exists.</p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <p className={cn("mb-3", LABEL)}>{focusDistrict ? `${focusDistrict} · PIN codes` : "Statewide · PIN codes"}</p>
              <label className="relative mb-3 block">
                <input value={pinQuery} onChange={(e) => setPinQuery(e.target.value)} placeholder="Search PIN code..." aria-label="Search PIN codes" className="w-full rounded-xl border border-border bg-elevated/60 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-saffron/60 focus:ring-2 focus:ring-saffron/20" />
              </label>
              <div className="-mr-1 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
                <ul className="space-y-0.5">
                  {pinRows.map((p) => {
                    const lead = leadingParty(p.results);
                    const on = activePincode === p.pincode;
                    return (
                      <li key={p.pincode}>
                        <button type="button" title={`${p.pincode} · ${p.district}`} aria-pressed={on} onMouseEnter={() => setHoveredDistrict(null)} onClick={() => onSelectPincode(p.pincode)}
                          className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60", on ? "bg-saffron/15 text-foreground" : "text-foreground/75 hover:bg-elevated hover:text-foreground")}>
                          <span className="tabular-nums font-medium">{p.pincode}</span>
                          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{p.samples.toLocaleString("en-IN")}</span>
                          <span className="size-1.5 rounded-full" style={{ background: PARTY_META[lead].color }} title={`Leading: ${PARTY_META[lead].label}`} />
                        </button>
                      </li>
                    );
                  })}
                  {pinRows.length === 0 && <li className="px-2 py-6 text-center text-[12.5px] text-muted-foreground">No PIN codes found.</li>}
                </ul>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Demonstration PIN codes — not from an uploaded dataset.</p>
            </div>
          )}
        </section>
      </section>

      {/* published (real) dataset strip — renders only after the admin publishes */}
      <div className="relative z-10 mx-auto max-w-[1720px] px-4 lg:px-6">
        <PublishedSummary slug="tamil-nadu" />
      </div>

      {/* bottom preview cards */}
      <section className="relative z-10 mx-auto max-w-[1720px] px-4 pb-16 pt-8 lg:px-6">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">How to explore</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {MODES.map(({ id, title, desc, Icon }, i) => (
            <button key={id} type="button" onClick={() => applyMode(id)} className="rounded-2xl border border-border bg-card/60 p-4 text-left backdrop-blur-xl transition-colors hover:border-saffron/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-serif text-2xl italic text-saffron-2">{String(i + 1).padStart(2, "0")}</span>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <h3 className="font-display text-[15px] font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{desc}</p>
            </button>
          ))}
          <button type="button" onClick={() => applyMode("district")} className="rounded-2xl border border-border bg-card/60 p-4 text-left backdrop-blur-xl transition-colors hover:border-saffron/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-serif text-2xl italic text-saffron-2">04</span>
              <MapPin className="size-4 text-muted-foreground" />
            </div>
            <h3 className="font-display text-[15px] font-semibold text-foreground">Multi-District View</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">Compare multiple districts together.</p>
          </button>
        </div>
      </section>
    </div>
  );
}
