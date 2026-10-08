"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Activity, ArrowLeft, ChevronDown, Layers, RotateCcw } from "lucide-react";
import {
  PARTY_META,
  aggregate,
  datasetFor,
  findPincode,
  rowsForDistricts,
  STATEWIDE,
  type PollType,
} from "@/lib/data/tamil-nadu-poll-data";
import PollToggle from "./poll-toggle";
import PollSummary from "./poll-summary";
import PollChart from "./poll-chart";
import DistrictFilter from "./district-filter";

// three.js is heavy — load the map only on the client, after first paint.
const TamilNaduMap = dynamic(() => import("./tamil-nadu-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-sm text-white/45">Loading Tamil Nadu…</div>
  ),
});

/** Small schematic preview for the drilldown cards at the bottom. */
function Preview({ mode }: { mode: "state" | "district" | "pincode" | "multi" }) {
  const poly = (points: string, key: string, cls: string) => <polygon key={key} points={points} className={cls} strokeWidth="0.8" />;
  return (
    <svg viewBox="0 0 120 120" className="h-20 w-full">
      <g fill="rgba(60,110,200,.28)" stroke="rgba(120,180,255,.55)">
        {[
          "18,26 44,18 52,34 34,40",
          "52,34 74,22 84,38 64,46",
          "34,40 52,34 64,46 50,60 32,58",
          "64,46 84,38 90,56 70,62",
          "50,60 64,46 70,62 62,78 48,74",
          "32,58 50,60 48,74 30,72",
          "62,78 70,62 86,74 74,92",
          "48,74 62,78 56,96 40,90",
          "30,72 48,74 40,90 26,86",
          "74,92 86,74 92,90 80,104",
          "40,90 56,96 50,110 36,104",
        ].map((p, i) => poly(p, "d" + i, "transition-all duration-300"))}
      </g>
      {mode === "district" && <polygon points="52,34 74,22 84,38 64,46" fill="rgba(255,153,51,.28)" stroke="rgba(255,170,90,.9)" strokeWidth="0.8" />}
      {mode === "district" && [["66", "30"], ["72", "36"], ["60", "40"]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.6" fill="#ffb866" />)}
      {mode === "pincode" && (
        <g>
          <polygon points="52,34 74,22 84,38 64,46" fill="rgba(255,153,51,.14)" stroke="rgba(255,170,90,.9)" strokeWidth="0.8" />
          {[["60", "32"], ["68", "36"], ["64", "42"], ["72", "30"]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i === 1 ? 3 : 1.8} fill={i === 1 ? "#ffffff" : "rgba(120,180,255,.8)"} stroke="rgba(255,255,255,.6)" strokeWidth="0.5" />
          ))}
        </g>
      )}
      {mode === "multi" && (
        <g>
          <polygon points="52,34 74,22 84,38 64,46" fill="rgba(255,153,51,.28)" stroke="rgba(255,170,90,.9)" strokeWidth="0.8" />
          <polygon points="34,40 52,34 50,60 32,58" fill="rgba(255,153,51,.28)" stroke="rgba(255,170,90,.9)" strokeWidth="0.8" />
          <polygon points="30,72 48,74 40,90 26,86" fill="rgba(255,153,51,.28)" stroke="rgba(255,170,90,.9)" strokeWidth="0.8" />
        </g>
      )}
    </svg>
  );
}

const PREVIEWS: { mode: "state" | "district" | "pincode" | "multi"; title: string; desc: string }[] = [
  { mode: "state", title: "State View", desc: "All 38 districts across Tamil Nadu." },
  { mode: "district", title: "District Focus", desc: "Zoom in; the district's pincodes appear." },
  { mode: "pincode", title: "Pincode View", desc: "Select a pincode for local poll data." },
  { mode: "multi", title: "Multiple Districts", desc: "Compare several districts at once." },
];

/**
 * Tamil Nadu case study: a premium election-intelligence dashboard matching the
 * approved reference — large hero map, floating analytics rail, district filter
 * and a State → District → Pincode drilldown. All figures are MOCK data.
 */
export default function TamilNaduDashboard() {
  const [pollType, setPollType] = useState<PollType>("exit");
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<string | null>(null);
  const [activePincode, setActivePincode] = useState<string | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [resetNonce, setResetNonce] = useState(0);

  const dataset = useMemo(() => datasetFor(pollType), [pollType]);
  const allRows = useMemo(() => dataset.map((d) => ({ name: d.district, samples: d.samples })), [dataset]);
  const activePin = useMemo(() => (activePincode ? findPincode(activePincode, pollType) : undefined), [activePincode, pollType]);

  const headline = useMemo(() => {
    if (activePin) {
      return { samples: activePin.samples, results: activePin.results, scope: `${activePin.district} / ${activePin.pincode}`, chip: "Pincode" };
    }
    if (selectedDistricts.length === 0) {
      const sw = STATEWIDE[pollType];
      return { samples: sw.samples, results: sw.results, scope: "All Tamil Nadu", chip: undefined };
    }
    const agg = aggregate(rowsForDistricts(selectedDistricts, pollType));
    const scope =
      selectedDistricts.length <= 3
        ? selectedDistricts.join(" + ")
        : `${selectedDistricts.slice(0, 3).join(" + ")} +${selectedDistricts.length - 3}`;
    const chip = selectedDistricts.length > 1 ? `${selectedDistricts.length} districts` : undefined;
    return { ...agg, scope, chip };
  }, [activePin, selectedDistricts, pollType]);

  const toggleDistrict = useCallback((name: string) => {
    setActivePincode(null);
    setSelectedDistricts((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }, []);

  const onMapSelectDistrict = useCallback((name: string | null) => {
    setActivePincode(null);
    if (name) {
      setActiveDistrict(name);
      setSelectedDistricts([name]);
    } else {
      setActiveDistrict(null);
      setSelectedDistricts([]);
    }
  }, []);

  const onSelectPincode = useCallback((pin: string | null) => setActivePincode(pin), []);

  return (
    <div className="relative min-h-screen bg-[#04091a]">
      {/* ambient backdrop */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_10%,rgba(30,80,180,.28),transparent_60%),radial-gradient(50%_50%_at_90%_100%,rgba(255,153,51,.08),transparent_60%),linear-gradient(180deg,#050d22,#04091a_70%)]"
        aria-hidden
      />
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay" aria-hidden />

      {/* ---------- hero: map + floating overlays ---------- */}
      <section className="relative mx-auto max-w-[1680px] px-4 pb-4 pt-20 lg:h-[100svh] lg:min-h-[760px] lg:px-6">
        {/* title — overlay top-left on desktop, in flow on mobile */}
        <header className="relative z-30 mb-4 max-w-[380px] lg:absolute lg:left-8 lg:top-24 lg:mb-0 lg:max-w-[340px]">
          <Link
            href="/#tour"
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[13px] text-white/75 backdrop-blur-xl transition hover:text-white focus-visible:ring-2 focus-visible:ring-saffron/60 focus-visible:outline-none"
          >
            <ArrowLeft className="size-3.5" /> Back to India Map
          </Link>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-saffron-2">Tamil Nadu · Election Intelligence</p>
          <h1 className="mt-2 font-display text-[clamp(34px,4vw,54px)] font-semibold leading-[0.98] tracking-[-0.03em]">Tamil Nadu</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
            <b className="font-bold" style={{ color: PARTY_META.aiadmk.color }}>AIADMK</b>
            <span className="text-white/55">Edappadi K. Palaniswami</span>
          </p>
          <p className="mt-1.5 text-[13px] text-white/45">Constituency, district and pincode-level voter intelligence.</p>
        </header>

        {/* map — fills the section on desktop */}
        <div className="relative z-0 h-[56svh] min-h-[420px] lg:absolute lg:inset-0 lg:h-full">
          <TamilNaduMap
            pollType={pollType}
            districts={dataset}
            selectedDistricts={selectedDistricts}
            activeDistrict={activeDistrict}
            hoveredDistrict={hoveredDistrict}
            activePincode={activePincode}
            resetNonce={resetNonce}
            onHoverDistrict={setHoveredDistrict}
            onSelectDistrict={onMapSelectDistrict}
            onSelectPincode={onSelectPincode}
          />
        </div>

        {/* left floating controls (desktop) */}
        <div className="absolute bottom-10 left-8 z-20 hidden w-[200px] flex-col gap-2.5 lg:flex">
          <div className="glass flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5">
            <Layers className="size-4 text-saffron-2" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/55">Districts</span>
            <span className="ml-auto font-display text-sm font-semibold text-white">{selectedDistricts.length || 0} / {allRows.length}</span>
          </div>
          <button type="button" className="glass flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left transition hover:border-white/25">
            <Activity className="size-4 text-saffron-2" />
            <span className="text-[12px] font-semibold text-white/85">Map View<span className="ml-1 block text-[10px] font-normal uppercase tracking-[0.14em] text-white/40">Survey</span></span>
            <ChevronDown className="ml-auto size-4 text-white/45" />
          </button>
          <button
            type="button"
            onClick={() => setResetNonce((n) => n + 1)}
            className="glass flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-[12px] font-semibold text-white/85 transition hover:border-white/25 focus-visible:ring-2 focus-visible:ring-saffron/60 focus-visible:outline-none"
          >
            <RotateCcw className="size-4 text-saffron-2" /> Reset View
          </button>
          <div className="glass rounded-2xl px-3.5 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Survey intensity</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-[linear-gradient(90deg,rgba(120,180,255,.35),#ffb866_60%,#ff7a1a)]" />
            <div className="mt-1.5 flex justify-between text-[9.5px] uppercase tracking-[0.14em] text-white/35">
              <span>Low</span><span>High</span>
            </div>
          </div>
        </div>

        {/* analytics rail (center-right on desktop) */}
        <section className="relative z-20 mx-auto mt-4 max-w-xl rounded-3xl border border-white/10 bg-[#081127]/80 p-4 shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] backdrop-blur-2xl lg:absolute lg:right-[27%] lg:top-24 lg:mt-0 lg:w-[300px] lg:max-w-none">
          <PollToggle value={pollType} onChange={(v) => { setPollType(v); setActivePincode(null); }} />
          <div className="my-3.5 border-t border-dashed border-white/10" />
          <PollSummary scope={headline.scope} samples={headline.samples} results={headline.results} chip={headline.chip} />
          <div className="my-3.5 border-t border-dashed border-white/10" />
          <PollChart results={headline.results} centerLabel={activePin ? "PIN" : undefined} />
          <p className="mt-3.5 text-[10px] leading-relaxed text-white/30">
            MOCK DATA — replace with backend/API data later. Switch poll type, pick districts, or click a survey point.
          </p>
        </section>

        {/* district filter (far right on desktop) */}
        <section className="relative z-20 mx-auto mt-4 flex max-w-xl flex-col rounded-3xl border border-white/10 bg-[#081127]/80 p-4 shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] backdrop-blur-2xl lg:absolute lg:bottom-8 lg:right-8 lg:top-24 lg:mt-0 lg:w-[248px] lg:max-w-none">
          <DistrictFilter
            rows={allRows}
            selected={selectedDistricts}
            activeDistrict={activeDistrict}
            onToggle={toggleDistrict}
            onSelectAll={() => { setSelectedDistricts([]); setActiveDistrict(null); setActivePincode(null); }}
            onClear={() => { setSelectedDistricts([]); setActiveDistrict(null); setActivePincode(null); }}
            onHover={setHoveredDistrict}
            onActivate={(name) => {
              if (!name) { setActiveDistrict(null); setActivePincode(null); return; }
              setActiveDistrict(selectedDistricts.includes(name) ? null : name);
              setActivePincode(null);
            }}
          />
        </section>
      </section>

      {/* ---------- bottom drilldown preview cards ---------- */}
      <section className="relative z-10 mx-auto max-w-[1680px] px-4 pb-16 pt-8 lg:px-6">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">How to explore</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {PREVIEWS.map((p, i) => (
            <article key={p.mode} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl transition hover:border-white/20">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-serif text-2xl italic text-saffron-2">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Step</span>
              </div>
              <div className="mb-2 rounded-xl bg-[#050d22]/70 p-2">
                <Preview mode={p.mode} />
              </div>
              <h3 className="font-display text-[15px] font-semibold">{p.title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-white/50">{p.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
