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
import { divideDistrictAcrossPins, pinShares } from "@/lib/pin-divide";
import { useTheme } from "@/components/theme-provider";
import PollToggle from "./poll-toggle";
import PollSummary from "./poll-summary";
import PollChart from "./poll-chart";
import DistrictFilter from "./district-filter";
import PublishedSummary from "./published-summary";
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

// NOTE: "Geographic Context" (neighbouring-geography labels) was removed from
// the map at 8cd7899 and is currently a no-op, so its control is not shown
// until it is functional again (per the no-dead-toggle requirement).
const LAYER_LABELS: { id: keyof MapLayers; label: string }[] = [
  { id: "boundaries", label: "District Boundaries" },
  { id: "pins", label: "PIN Code Markers" },
  { id: "labels", label: "District Labels" },
];

const LABEL = "text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground";

type PubPin = {
  pin: string; total: number; valid: number; parties: Record<string, number>;
  district: string | null; locationAvailable: boolean;
  lat?: number | null; lng?: number | null; postalPlace?: string | null; coordSource?: string | null;
  allocated?: boolean;
  basis?: string; basisKey?: string; source?: string; method?: string; allocationVersion?: string; districtBasis?: string;
};

export default function TamilNaduDashboard() {
  const { theme } = useTheme();

  /* ---- one shared geography state: mode + selected regions ---- */
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [activePincode, setActivePincode] = useState<string | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null); // transient only

  const [pollType, setPollType] = useState<PollType>("exit");
  const [view, setView] = useState<"recorded" | "estimated">("recorded");
  const [layers, setLayers] = useState<MapLayers>({ boundaries: true, pins: true, labels: true, context: false });
  const [pinQuery, setPinQuery] = useState("");
  /** Clearly-labelled demo mode: shows the original synthetic PIN markers. */
  const [demoPins, setDemoPins] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const dataset = useMemo(() => datasetFor(pollType), [pollType]);
  const focusDistrict = selectedDistricts.length === 1 ? selectedDistricts[0] : null;
  // Navigation is derived from the selection: any selected district reveals its
  // PINs automatically (no public State/District/PIN view selectors).
  const geoMode: MapMode = selectedDistricts.length > 0 ? "pincode" : "state";
  const activePin = useMemo(() => (activePincode ? findPincode(activePincode, pollType) : undefined), [activePincode, pollType]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(t);
  }, [notice]);

  /* ---- published per-district survey aggregates (live) ---- */
  const [live, setLive] = useState<{ published: boolean; assumed?: boolean; districts: { district: string; total: number; valid: number; parties?: Record<string, number>; recorded?: number; allocated?: number }[]; valid: number; total: number } | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/public/case-studies/tamil-nadu/districts?pollType=${pollType}&basis=${view}`, { cache: "no-store", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setLive(d && d.published
          ? { published: true, assumed: !!d.assumed, districts: (d.districts ?? []).map((x: { district: string; total?: number; valid?: number; parties?: Record<string, number>; recorded?: number; allocated?: number }) => ({ district: x.district, total: x.total ?? 0, valid: x.valid ?? 0, parties: x.parties, recorded: x.recorded, allocated: x.allocated })), valid: d.valid ?? 0, total: d.total ?? 0 }
          : { published: false, districts: [], valid: 0, total: 0 });
      })
      .catch(() => { if (!ctrl.signal.aborted) setLive({ published: false, districts: [], valid: 0, total: 0 }); });
    return () => ctrl.abort();
  }, [pollType, view, refreshNonce]);

  /* ---- published PIN breakdown. The committed district-based allocation is
     shown automatically (recorded PINs preserved where available); there is no
     public scenario switch. ---- */
  const [pinData, setPinData] = useState<{
    usablePins: number; pins: PubPin[]; message: string | null; withPin: number; withoutPin: number;
    committed: boolean; allocatedPins: number; referencePinsTotal: number; referenceComplete: boolean;
    withCoordinates: number; allocationVersion: string | null;
    reference: { name: string; source: string; version: string; completeness?: string } | null;
    scenario: { assigned: number; unresolved: number; eligible: number; recordedPin: number; appliedAt: string | null } | null;
  } | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/public/case-studies/tamil-nadu/pins?pollType=${pollType}&basis=assumed`, { cache: "no-store", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setPinData(d && d.published ? {
          usablePins: d.usablePins ?? 0, pins: d.pins ?? [], message: d.message ?? null,
          withPin: d.withPin ?? 0, withoutPin: d.withoutPin ?? 0,
          committed: !!d.committed, allocatedPins: d.allocatedPins ?? 0,
          referencePinsTotal: d.referencePinsTotal ?? 0, referenceComplete: !!d.referenceComplete,
          withCoordinates: d.withCoordinates ?? 0,
          allocationVersion: d.allocationVersion ?? null,
          reference: d.reference ? { name: d.reference.name, source: d.reference.source, version: d.reference.version, completeness: d.reference.completeness } : null,
          scenario: d.scenario ? { assigned: d.scenario.assigned ?? 0, unresolved: d.scenario.unresolved ?? 0, eligible: d.scenario.eligible ?? 0, recordedPin: d.scenario.recordedPin ?? 0, appliedAt: d.scenario.appliedAt ?? null } : null,
        } : null);
      })
      .catch(() => { if (!ctrl.signal.aborted) setPinData(null); });
    return () => ctrl.abort();
  }, [pollType, refreshNonce]);

  // The displayed district dataset is configured in admin (no public control).
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/public/case-studies/tamil-nadu/settings`, { cache: "no-store", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!ctrl.signal.aborted && (d?.displayBasis === "estimated" || d?.displayBasis === "recorded")) setView(d.displayBasis); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [refreshNonce]);

  // Statewide totals: every supplied record (total) with shares from valid only.
  const [stateTotals, setStateTotals] = useState<{ total: number; valid: number; shares: { party: string; count: number; pct: number }[] } | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/public/case-studies/tamil-nadu/summary`, { cache: "no-store", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (ctrl.signal.aborted) return;
        const block = pollType === "exit" ? d?.exit : d?.opinion;
        setStateTotals(block?.counts ? { total: block.counts.total ?? 0, valid: block.counts.valid ?? 0, shares: block.shares?.shares ?? [] } : null);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [pollType, refreshNonce]);

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
  // When demo mode is on, the PIN experience uses the labelled demonstration
  // dataset (synthetic positions + sample results) instead of uploaded data.
  const liveActive = intensityActive && !demoPins;

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

  /* PIN Codes is a district-share lookup: the bundled reference PIN list, and
     selecting a PIN shows its PARENT DISTRICT's current survey shares. No
     allocation/commit is required. */
  const currentPins = pinData?.pins ?? [];
  const districtValidByName = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of live?.districts ?? []) m[d.district] = d.valid;
    return m;
  }, [live]);
  // Parent district of the selected PIN (from the reference), else the focused district.
  const selectedRefPin = activePincode ? currentPins.find((p) => p.pin === activePincode) : undefined;
  const parentDistrict = selectedRefPin?.district ?? focusDistrict ?? null;
  const districtRow = parentDistrict ? live?.districts.find((d) => d.district === parentDistrict) : undefined;
  // Even division of the parent district's responses across its eligible PINs.
  const districtPinList = parentDistrict ? currentPins.filter((p) => p.district === parentDistrict).map((p) => p.pin) : [];
  const division = parentDistrict && districtRow
    ? divideDistrictAcrossPins(districtRow.valid, districtRow.parties ?? {}, districtPinList)
    : [];
  const selectedDivision = activePincode ? division.find((d) => d.pin === activePincode) : undefined;
  const selectedPinShares = selectedDivision ? pinShares(selectedDivision) : [];
  const districtShares = districtRow
    ? Object.entries(districtRow.parties ?? {})
        .map(([party, count]) => ({ party, count, pct: districtRow.valid ? +((count / districtRow.valid) * 100).toFixed(2) : 0 }))
        .sort((a, b) => b.count - a.count)
    : [];
  const filteredPublishedPins = (() => {
    const base = selectedDistricts.length ? currentPins.filter((p) => selectedDistricts.includes(p.district ?? "")) : currentPins;
    const q = pinQuery.trim();
    return q ? base.filter((p) => p.pin.includes(q)) : base;
  })();
  // Reference PINs of the focused district without a mapped coordinate → inset.
  const unresolvedPins = filteredPublishedPins.filter((p) => !p.locationAvailable);

  // Survey markers: the reference PINs that have a POSTAL-AREA coordinate. The
  // tooltip reports the PIN's parent-district response total (never summed).
  const surveyPins = useMemo(
    () => currentPins
      .filter((p) => p.locationAvailable && p.lat != null && p.lng != null)
      .map((p) => ({ pin: p.pin, lat: p.lat as number, lng: p.lng as number, district: p.district ?? "", valid: districtValidByName[p.district ?? ""] ?? 0, place: p.postalPlace ?? null })),
    [currentPins, districtValidByName],
  );

  // Clear a PIN selection that no longer belongs to the focused district set
  // (keeps the results panel, list and markers on the same selection state).
  useEffect(() => {
    if (!activePincode) return;
    const d = currentPins.find((p) => p.pin === activePincode)?.district ?? null;
    if (selectedDistricts.length === 0 || (d && !selectedDistricts.includes(d))) setActivePincode(null);
  }, [selectedDistricts, activePincode, currentPins]);

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
    for (const d of rows) for (const [p, c] of Object.entries(d.parties ?? {})) parties[p] = (parties[p] ?? 0) + c;
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

  /* ---- geography transitions (single source of truth: the selection) ---- */
  const clearSelection = useCallback(() => {
    setHoveredDistrict(null);
    setSelectedDistricts([]);
    setActivePincode(null);
    setPinQuery("");
  }, []);

  // Selecting a district ADDS it to the focused set (a second selection never
  // silently replaces the first); selecting it again removes it.
  const toggleDistrict = useCallback((name: string) => {
    setHoveredDistrict(null);
    setActivePincode(null);
    setSelectedDistricts((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }, []);

  const onMapSelectDistrict = useCallback((name: string | null) => {
    setHoveredDistrict(null);
    setActivePincode(null);
    if (name) toggleDistrict(name);
    else clearSelection();
  }, [toggleDistrict, clearSelection]);

  const onSelectPincode = useCallback((pin: string | null) => {
    setActivePincode(pin);
  }, []);

  const changePollType = (v: PollType) => {
    if (v === pollType) return;
    setPollType(v);
    setHoveredDistrict(null);
    if (activePincode) { setActivePincode(null); setNotice("PIN selection cleared — PIN results differ per poll type."); }
  };

  const resetView = useCallback(() => {
    setResetNonce((n) => n + 1);
    setSelectedDistricts([]);
    setActivePincode(null);
    setHoveredDistrict(null);
    setNotice(null);
    setPinQuery("");
  }, []);

  const pinDistrict = parentDistrict ?? activePin?.district ?? focusDistrict;
  const activePinCode = activePincode ?? activePin?.pincode ?? null;
  const crumbs: { label: string; onClick?: () => void }[] = [{ label: "Tamil Nadu", onClick: clearSelection }];
  if (pinDistrict) crumbs.push({ label: pinDistrict, onClick: () => { setActivePincode(null); } });
  if (activePinCode) crumbs.push({ label: activePinCode });

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
          <p className="px-1 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            {selectedDistricts.length === 0 ? "Tamil Nadu · statewide" : `${selectedDistricts.length} district${selectedDistricts.length > 1 ? "s" : ""} selected`}
          </p>
          {selectedDistricts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedDistricts.map((d) => (
                <span key={d} className="inline-flex items-center gap-1 rounded-full border border-saffron/50 bg-saffron/10 px-2.5 py-1 text-[11.5px] font-semibold text-saffron-2">
                  {d}
                  <button type="button" onClick={() => toggleDistrict(d)} aria-label={`Remove ${d}`} className="grid size-4 place-items-center rounded-full text-saffron-2 transition-colors hover:bg-saffron/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">×</button>
                </span>
              ))}
            </div>
          )}
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

          {intensityActive && (
            <label className="flex items-center gap-2 rounded-2xl border border-border bg-card/60 px-3.5 py-2.5 text-[11.5px] text-muted-foreground">
              <input type="checkbox" checked={demoPins} onChange={(e) => setDemoPins(e.target.checked)} />
              Demonstration PIN markers
              <span className="ml-auto rounded border border-border px-1 py-px text-[9px] uppercase tracking-wide">demo</span>
            </label>
          )}

          {intensity && (
            <SurveyLegend theme={theme} ranges={intensity.ranges} hasData={intensity.hasData} className="hidden lg:block" />
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
            forceDemo={demoPins}
            surveyPins={surveyPins}
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

          {/* Subtle background softening: a cheap periphery vignette (no blur of
              selected geometry/markers/controls — dimming remains the fallback). */}
          {selectedDistricts.length > 0 && (
            <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(62%_62%_at_50%_48%,transparent_38%,rgba(0,0,0,0.34)_100%)] transition-opacity duration-300 motion-reduce:transition-none" />
          )}

          {/* District inset: PINs without a mapped location. A non-geographic
              flow layout, deliberately not a coordinate plot. */}
          {geoMode === "pincode" && liveActive && focusDistrict && unresolvedPins.length > 0 && (
            <div className="pointer-events-none absolute bottom-4 left-4 z-10 w-[218px] rounded-2xl border border-border bg-card/90 p-3 backdrop-blur-md lg:bottom-8 lg:left-[300px]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">PINs without mapped locations</p>
              <p className="mt-0.5 text-[9.5px] leading-relaxed text-muted-foreground">{focusDistrict} · positions are not geographic.</p>
              <div className="pointer-events-auto mt-2 flex max-h-40 flex-wrap gap-1 overflow-y-auto [scrollbar-width:thin]">
                {unresolvedPins.map((p) => (
                  <button key={p.pin} type="button" onClick={() => onSelectPincode(p.pin)} title={`${p.pin} · ${p.district ?? ""} · no mapped location`}
                    className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60", activePincode === p.pin ? "border-saffron/50 bg-saffron/15 text-foreground" : "border-border text-foreground/75 hover:bg-elevated")}>
                    <svg width="10" height="14" viewBox="0 0 18 26" fill="none" aria-hidden><path d="M9 1C4.58 1 1 4.58 1 9c0 5.6 8 16 8 16s8-10.4 8-16c0-4.42-3.58-8-8-8Z" fill="#3d8bfd" stroke="rgba(255,255,255,.9)" stroke-width="1.4"/><circle cx="9" cy="9" r="3.1" fill="#04091a"/></svg>
                    {p.pin}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* mobile: legend directly below the map */}
        {intensity && (
          <SurveyLegend theme={theme} ranges={intensity.ranges} hasData={intensity.hasData} className="mt-3 lg:hidden" />
        )}

        {/* right: analysis */}
        <section className="relative z-20 mx-auto mt-4 max-w-xl rounded-2xl border border-border bg-card/85 p-4 shadow-[0_18px_50px_-30px_rgba(15,20,30,0.45)] backdrop-blur-2xl lg:absolute lg:right-[292px] lg:top-24 lg:mt-0 lg:w-[276px] lg:max-w-none">
          <PollToggle value={pollType} onChange={changePollType} />

          <div className="my-3.5 border-t border-dashed border-border" />

          {geoMode === "pincode" ? (
            liveActive && activePincode ? (
              <div>
                <p className={LABEL}>PIN code · {parentDistrict ?? "district not stated"}</p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <span className="font-display text-2xl font-semibold tabular-nums text-foreground">{activePincode}</span>
                  <span className="text-[11.5px] text-muted-foreground">Survey responses: <b className="tabular-nums text-foreground/85">{(selectedDivision?.valid ?? 0).toLocaleString("en-IN")}</b></span>
                </div>
                {!selectedDivision || selectedDivision.valid === 0 ? (
                  <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">No survey responses for this PIN.</p>
                ) : (
                  <>
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Party share</p>
                    <ul className="mt-1.5 space-y-2">
                      {selectedPinShares.map((s) => (
                        <li key={s.party} className="text-[12px]">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="min-w-0 break-words text-foreground/85">{s.party}</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">{s.count.toLocaleString("en-IN")} · {s.pct}%</span>
                          </div>
                          <span className="mt-1 block h-2 overflow-hidden rounded-full bg-elevated"><span className="block h-full rounded-full bg-saffron" style={{ width: `${s.pct}%` }} /></span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {selectedRefPin && !selectedRefPin.locationAvailable && <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">No mapped location for this PIN.</p>}
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">PIN breakdown allocated from district survey totals.</p>
              </div>
            ) : liveActive && liveSelection ? (
              <div>
                <p className={LABEL}>{selectedDistricts.length > 1 ? "Selected districts" : "Selected district"}</p>
                <p className="mt-1 min-w-0 truncate font-display text-[15px] font-semibold text-foreground">
                  {selectedDistricts.length <= 3 ? selectedDistricts.join(" & ") : `${selectedDistricts.slice(0, 3).join(" & ")} +${selectedDistricts.length - 3}`}
                </p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className={LABEL}>Survey responses</p>
                    <p className="font-display text-3xl font-semibold tabular-nums text-foreground">{liveSelection.denom.toLocaleString("en-IN")}</p>
                  </div>
                  <p className="shrink-0 text-right text-[11px] text-muted-foreground">{pollLabel}</p>
                </div>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Party share</p>
                <ul className="mt-2 space-y-2.5">
                  {liveSelection.shares.length === 0 ? (
                    <li className="text-[12.5px] text-muted-foreground">No data available for this selection.</li>
                  ) : (
                    liveSelection.shares.map((s) => (
                      <li key={s.party} className="text-[12.5px]">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 break-words text-foreground/85">{s.party}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">{s.count.toLocaleString("en-IN")} · {s.pct}%</span>
                        </div>
                        <span className="mt-1 block h-2 overflow-hidden rounded-full bg-elevated"><span className="block h-full rounded-full bg-saffron" style={{ width: `${s.pct}%` }} /></span>
                      </li>
                    ))
                  )}
                </ul>
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Select a PIN code to view survey results.</p>
              </div>
            ) : liveActive ? (
              <p className="py-2 text-[12.5px] leading-relaxed text-muted-foreground">Select a PIN code to view survey results.</p>
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
                  <p className={LABEL}>{selectedDistricts.length === 0 ? "Total responses" : "Survey responses"}</p>
                  <p className="font-display text-3xl font-semibold tabular-nums text-foreground">{(selectedDistricts.length === 0 ? stateTotals?.total ?? liveSelection.denom : liveSelection.denom).toLocaleString("en-IN")}</p>
                </div>
                <p className="shrink-0 text-right text-[11px] text-muted-foreground">{pollLabel}</p>
              </div>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Party share</p>
              <ul className="mt-2 space-y-2.5">
                {(selectedDistricts.length === 0 && stateTotals ? stateTotals.shares : liveSelection.shares).length === 0 ? (
                  <li className="text-[12.5px] text-muted-foreground">No data available for this selection.</li>
                ) : (
                  (selectedDistricts.length === 0 && stateTotals ? stateTotals.shares : liveSelection.shares).map((s) => (
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

          {intensityActive && view === "estimated" && (
            <p className="mt-3 text-[10px] leading-relaxed text-saffron-2">Includes responses allocated from missing geography.</p>
          )}

          {intensityActive ? (
            <details className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
                About this data
              </summary>
              <div className="mt-1.5 space-y-1">
                <p>Dataset: {pollLabel}, {basisLabel} district results.</p>
                <p>Party shares use the district’s valid party responses as the denominator.</p>
                <p>PIN codes are postal-area references, not respondent locations.{pinData ? ` ${pinData.withCoordinates}/${pinData.referencePinsTotal} reference PINs have a mapped location.` : ""}</p>
                {pinData?.reference && <p>Postal reference: {pinData.reference.name} · {pinData.reference.version}.</p>}
              </div>
            </details>
          ) : (
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">MOCK DATA — vote estimates shown for demonstration only.</p>
          )}
        </section>

        {/* right: filters */}
        <section id="geo-panel" role="region" aria-label="Geography details" className="relative z-20 mx-auto mt-4 flex max-w-xl flex-col rounded-2xl border border-border bg-card/85 p-4 shadow-[0_18px_50px_-30px_rgba(15,20,30,0.45)] backdrop-blur-2xl lg:absolute lg:bottom-8 lg:right-8 lg:top-24 lg:mt-0 lg:w-[240px] lg:max-w-none">
          <DistrictFilter
            rows={allRows}
            selected={selectedDistricts}
            onToggle={toggleDistrict}
            onSelectAll={clearSelection}
            onClear={clearSelection}
            onHover={setHoveredDistrict}
          />
          {selectedDistricts.length > 0 && liveActive ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <p className={cn("mb-3 border-t border-border pt-3", LABEL)}>
                {selectedDistricts.length === 1 ? selectedDistricts[0] : `${selectedDistricts.length} districts`} · {filteredPublishedPins.length.toLocaleString("en-IN")} PIN {filteredPublishedPins.length === 1 ? "code" : "codes"}
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
                        <button type="button"
                          title={`PIN ${p.pin} · ${p.district ?? "district unknown"}${p.locationAvailable ? "" : " · no mapped location"}`}
                          aria-pressed={on} onMouseEnter={() => setHoveredDistrict(null)} onClick={() => onSelectPincode(p.pin)}
                          className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60", on ? "bg-saffron/15 text-foreground" : "text-foreground/75 hover:bg-elevated hover:text-foreground")}>
                          <span className={cn("size-1.5 shrink-0 rounded-full", p.locationAvailable ? "bg-[#3d8bfd]" : "bg-muted-foreground/40")} aria-hidden />
                          <span className="tabular-nums font-medium">{p.pin}</span>
                          {!p.locationAvailable && <span className="ml-auto rounded border border-border px-1 py-px text-[9px] uppercase tracking-wide text-muted-foreground" title="No mapped location">no map ref</span>}
                        </button>
                      </li>
                    );
                  })}
                  {filteredPublishedPins.length === 0 && <li className="px-2 py-6 text-center text-[12.5px] text-muted-foreground">No PIN codes found.</li>}
                </ul>
              </div>
            </div>
          ) : selectedDistricts.length > 0 ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <p className={cn("mb-3", LABEL)}>{focusDistrict ? `${focusDistrict} · PIN codes` : "Selected districts · PIN codes"}</p>
              {demoPins && <p className="mb-2 rounded-lg border border-saffron/30 bg-saffron/10 px-2.5 py-1.5 text-[10.5px] leading-relaxed text-saffron-2">Demonstration PIN data — synthetic positions and sample shares, not uploaded survey data.</p>}
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
          ) : null}
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
            <button key={id} type="button" onClick={clearSelection} className="rounded-2xl border border-border bg-card/60 p-4 text-left backdrop-blur-xl transition-colors hover:border-saffron/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-serif text-2xl italic text-saffron-2">{String(i + 1).padStart(2, "0")}</span>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <h3 className="font-display text-[15px] font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{desc}</p>
            </button>
          ))}
          <button type="button" onClick={clearSelection} className="rounded-2xl border border-border bg-card/60 p-4 text-left backdrop-blur-xl transition-colors hover:border-saffron/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
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
