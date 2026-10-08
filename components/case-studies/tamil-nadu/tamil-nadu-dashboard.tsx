"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import ShimmerButton from "@/components/ui/shimmer-button";
import { useRouter } from "next/navigation";
import {
  PARTY_META,
  aggregate,
  datasetFor,
  findPincode,
  rowsForDistricts,
  STATEWIDE,
  type PollType,
} from "@/lib/data/tamil-nadu-poll-data";
import { LEADERS } from "@/lib/cases";
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

/**
 * Dedicated Tamil Nadu case study: an interactive political-intelligence
 * dashboard (3D district map + poll toggle + live chart + district filter).
 * All figures come from the MOCK dataset in lib/data/tamil-nadu-poll-data.ts.
 */
export default function TamilNaduDashboard() {
  const router = useRouter();
  const leader = LEADERS.find((l) => l.id === "eps");

  const [pollType, setPollType] = useState<PollType>("exit");
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<string | null>(null);
  const [activePincode, setActivePincode] = useState<string | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);

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

  const toggleDistrict = useCallback(
    (name: string) => {
      setActivePincode(null);
      setSelectedDistricts((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
    },
    [],
  );

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

  const onSelectPincode = useCallback((pin: string | null) => {
    setActivePincode(pin);
    if (pin) setActiveDistrict(null);
  }, []);

  const party = "AIADMK";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050b1f]">
      {/* ambient backdrop, same DNA as the homepage */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_80%_0%,rgba(255,153,51,.12),transparent_60%),radial-gradient(60%_70%_at_0%_100%,rgba(47,191,74,.08),transparent_60%),linear-gradient(180deg,rgba(5,11,31,.2),#050b1f_70%)]" aria-hidden />
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay" aria-hidden />

      <div className="relative mx-auto max-w-[1400px] px-5 pb-16 pt-28 sm:px-8">
        {/* header */}
        <div className="mb-7">
          <Link
            href="/#tour"
            className="glass mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white/80 transition hover:text-white focus-visible:ring-2 focus-visible:ring-saffron/60 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" /> Back to India Map
          </Link>

          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.26em] text-saffron-2">Tamil Nadu · Election Intelligence</span>
              <h1 className="mt-3 font-display text-[clamp(38px,5vw,64px)] font-semibold leading-[0.98] tracking-[-0.035em]">
                Tamil Nadu
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
                <b className="font-bold" style={{ color: PARTY_META.aiadmk.color }}>
                  {party}
                </b>
                <span className="text-white/55">Edappadi K. Palaniswami</span>
              </p>
              <p className="mt-2 max-w-xl text-sm text-white/45">
                Constituency, district and pincode-level voter intelligence.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/45">
                Demo data
              </span>
              <ShimmerButton
                text="Plan your campaign with us"
                duration={1.8}
                onClick={() => router.push("/#contact")}
                className="border-saffron/40 px-6 py-3 dark:bg-[#0a1a44]/80 backdrop-blur-xl"
              />
            </div>
          </div>
        </div>

        {/* dashboard */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,30%)] lg:items-stretch">
          {/* sidebar panel A: toggle + summary + chart */}
          <section className="relative order-1 rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_30px_80px_-40px_rgba(0,0,0,.9)] backdrop-blur-2xl lg:order-2 lg:col-start-2 lg:row-start-1">
            <span className="tricolor-line absolute inset-x-8 top-0 h-px opacity-60" aria-hidden />
            <PollToggle value={pollType} onChange={(v) => { setPollType(v); setActivePincode(null); }} />
            <div className="my-4 border-t border-dashed border-white/10" />
            <PollSummary scope={headline.scope} samples={headline.samples} results={headline.results} chip={headline.chip} />
            <div className="my-4 border-t border-dashed border-white/10" />
            <PollChart results={headline.results} centerLabel={activePin ? "PIN" : undefined} />
            <p className="mt-4 text-[10.5px] leading-relaxed text-white/30">
              MOCK DATA — replace with backend/API data later. Switch poll type, pick districts, or click a survey point.
            </p>
          </section>

          {/* map (visual focus) — no card chrome; the canvas blends into the page */}
          <div className="order-2 relative h-[58svh] min-h-[420px] lg:order-1 lg:col-start-1 lg:row-span-2 lg:h-auto lg:min-h-[80svh]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(58%_55%_at_50%_46%,rgba(24,58,130,.5),transparent_72%)]" aria-hidden />
            <TamilNaduMap
              pollType={pollType}
              districts={dataset}
              selectedDistricts={selectedDistricts}
              activeDistrict={activeDistrict}
              hoveredDistrict={hoveredDistrict}
              activePincode={activePincode}
              onHoverDistrict={setHoveredDistrict}
              onSelectDistrict={onMapSelectDistrict}
              onSelectPincode={onSelectPincode}
            />
          </div>

          {/* sidebar panel B: districts */}
          <section className="relative order-3 flex flex-col rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_30px_80px_-40px_rgba(0,0,0,.9)] backdrop-blur-2xl lg:order-3 lg:col-start-2 lg:row-start-2 lg:max-h-[52svh]">
            <DistrictFilter
              rows={allRows}
              selected={selectedDistricts}
              activeDistrict={activeDistrict}
              onToggle={toggleDistrict}
              onSelectAll={() => { setSelectedDistricts([]); setActiveDistrict(null); setActivePincode(null); }}
              onClear={() => { setSelectedDistricts([]); setActiveDistrict(null); setActivePincode(null); }}
              onHover={setHoveredDistrict}
              onActivate={(name) => {
                if (!name) {
                  setActiveDistrict(null);
                  setActivePincode(null);
                  return;
                }
                const willBeSelected = !selectedDistricts.includes(name);
                setActiveDistrict(willBeSelected ? name : null);
                setActivePincode(null);
              }}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
