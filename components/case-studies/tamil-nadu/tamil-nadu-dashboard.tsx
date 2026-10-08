"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, ChevronRight, Layers, Map as MapIcon, MapPin, Navigation, RotateCcw } from "lucide-react";
import {
  PARTY_META,
  PARTY_ORDER,
  aggregate,
  datasetFor,
  findPincode,
  rowsForDistricts,
  STATEWIDE,
  leadingParty,
  type PollType,
} from "@/lib/data/tamil-nadu-poll-data";
import { cn } from "@/lib/utils";
import PollToggle from "./poll-toggle";
import PollSummary from "./poll-summary";
import PollChart from "./poll-chart";
import DistrictFilter from "./district-filter";
import type { MapLayers, MapMode } from "./tamil-nadu-map";

const TamilNaduMap = dynamic(() => import("./tamil-nadu-map"), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center text-sm text-white/45">Loading Tamil Nadu…</div>,
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

export default function TamilNaduDashboard() {
  const [pollType, setPollType] = useState<PollType>("exit");
  const [mode, setMode] = useState<MapMode>("state");
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<string | null>(null);
  const [activePincode, setActivePincode] = useState<string | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [resetNonce, setResetNonce] = useState(0);
  const [filterTab, setFilterTab] = useState<"districts" | "pincodes">("districts");
  const [layers, setLayers] = useState<MapLayers>({ boundaries: true, pins: true, labels: true, context: true });
  const [pinQuery, setPinQuery] = useState("");

  const dataset = useMemo(() => datasetFor(pollType), [pollType]);
  const allRows = useMemo(() => dataset.map((d) => ({ name: d.district, samples: d.samples })), [dataset]);
  const activePin = useMemo(() => (activePincode ? findPincode(activePincode, pollType) : undefined), [activePincode, pollType]);

  // the single focused district for PIN drilldown
  const focusDistrict = selectedDistricts.length === 1 ? selectedDistricts[0] : null;
  const focusRow = useMemo(() => (focusDistrict ? dataset.find((d) => d.district === focusDistrict) : undefined), [focusDistrict, dataset]);

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

  const votes = useMemo(
    () => PARTY_ORDER.map((k) => ({ key: k, votes: Math.round((headline.samples * headline.results[k]) / 100) })),
    [headline],
  );

  const setMode2 = (m: MapMode) => {
    setMode(m);
    if (m === "state") { setSelectedDistricts([]); setActiveDistrict(null); setActivePincode(null); }
    if (m === "district") setActivePincode(null);
    if (m === "pincode") setFilterTab("pincodes");
    if (m !== "pincode") setFilterTab((t) => (t === "pincodes" ? "districts" : t));
  };

  const toggleDistrict = useCallback((name: string) => {
    setActivePincode(null);
    setSelectedDistricts((prev) => {
      const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name];
      setMode((m) => (m === "state" ? "district" : m));
      return next;
    });
  }, []);

  const onMapSelectDistrict = useCallback((name: string | null) => {
    setActivePincode(null);
    if (name) {
      setActiveDistrict(name);
      setSelectedDistricts([name]);
      setMode((m) => (m === "pincode" ? "district" : m));
    } else {
      setActiveDistrict(null);
      setSelectedDistricts([]);
      setMode("state");
    }
  }, []);

  const onSelectPincode = useCallback((pin: string | null) => {
    setActivePincode(pin);
    if (pin) setMode("pincode");
  }, []);

  const crumbs: { label: string; onClick?: () => void }[] = [{ label: "Tamil Nadu", onClick: () => setMode2("state") }];
  if (focusDistrict) crumbs.push({ label: focusDistrict, onClick: () => { setActivePincode(null); setMode2("district"); } });
  if (activePincode) crumbs.push({ label: activePincode });

  const filteredPins = useMemo(() => {
    if (!focusRow) return [];
    const q = pinQuery.trim();
    return focusRow.pincodes.filter((p) => !q || p.pincode.includes(q));
  }, [focusRow, pinQuery]);

  return (
    <div className="relative min-h-screen bg-[#04091a]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_18%_8%,rgba(30,80,180,.26),transparent_60%),radial-gradient(50%_50%_at_95%_100%,rgba(255,153,51,.07),transparent_60%),linear-gradient(180deg,#050d22,#04091a_70%)]" aria-hidden />
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay" aria-hidden />

      {/* ============ hero: map + floating panels ============ */}
      <section className="relative mx-auto max-w-[1720px] px-4 pb-4 pt-20 lg:h-[100svh] lg:min-h-[780px] lg:px-6">
        {/* title */}
        <header className="relative z-30 mb-4 max-w-[360px] lg:absolute lg:left-8 lg:top-24 lg:mb-0 lg:max-w-[320px]">
          <Link href="/#tour" className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[13px] text-white/75 backdrop-blur-xl transition hover:text-white focus-visible:ring-2 focus-visible:ring-saffron/60 focus-visible:outline-none">
            <ArrowLeft className="size-3.5" /> Back to India Map
          </Link>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-saffron-2">Tamil Nadu · Election Intelligence</p>
          <h1 className="mt-2 font-display text-[clamp(34px,4vw,52px)] font-semibold leading-[0.98] tracking-[-0.03em]">Tamil Nadu</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
            <b className="font-bold" style={{ color: PARTY_META.aiadmk.color }}>AIADMK</b>
            <span className="text-white/55">Edappadi K. Palaniswami</span>
          </p>
          <p className="mt-1.5 text-[13px] text-white/45">Constituency, district and pincode-level voter intelligence.</p>
          <nav aria-label="Breadcrumb" className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-white/50">
            {crumbs.map((c, i) => (
              <span key={c.label + i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="size-3 text-white/30" />}
                {c.onClick ? (
                  <button type="button" onClick={c.onClick} className="transition hover:text-white focus-visible:outline-none">{c.label}</button>
                ) : (
                  <span className="font-semibold text-saffron-2">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        </header>

        {/* map */}
        <div className="relative z-0 h-[54svh] min-h-[400px] lg:absolute lg:inset-0 lg:h-full">
          <TamilNaduMap
            pollType={pollType}
            districts={dataset}
            selectedDistricts={selectedDistricts}
            activeDistrict={activeDistrict}
            hoveredDistrict={hoveredDistrict}
            activePincode={activePincode}
            mode={mode}
            layers={layers}
            resetNonce={resetNonce}
            onHoverDistrict={setHoveredDistrict}
            onSelectDistrict={onMapSelectDistrict}
            onSelectPincode={onSelectPincode}
          />
        </div>

        {/* LEFT: explore geography + controls */}
        <div className="relative z-20 mt-4 w-full max-w-[250px] space-y-2 lg:absolute lg:left-8 lg:top-[356px] lg:mt-0 lg:w-[240px] lg:max-h-[calc(100svh-376px)] lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]">
          <p className="px-1 text-[10.5px] font-bold uppercase tracking-[0.22em] text-white/45">Explore Geography</p>
          {MODES.map(({ id, title, desc, Icon }) => {
            const active = mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setMode2(id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-all focus-visible:ring-2 focus-visible:ring-saffron/60 focus-visible:outline-none",
                  active ? "border-saffron/50 bg-saffron/[0.12] shadow-[0_0_0_1px_rgba(255,153,51,.25),0_18px_40px_-20px_rgba(255,153,51,.5)]" : "border-white/10 bg-white/[0.04] hover:border-white/20",
                )}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl border", active ? "border-saffron/40 bg-saffron/15 text-saffron-2" : "border-white/10 bg-white/[0.05] text-white/60")}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-white">{title}</span>
                  <span className="block truncate text-[11px] text-white/45">{desc}</span>
                </span>
              </button>
            );
          })}

          <div className="glass flex items-center gap-2.5 rounded-2xl px-3.5 py-2">
            <Layers className="size-4 text-saffron-2" />
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-white/55">Districts Selected</span>
            <span className="ml-auto font-display text-sm font-semibold text-white">{selectedDistricts.length} / {allRows.length}</span>
          </div>
          <button type="button" onClick={() => { setResetNonce((n) => n + 1); setMode2("state"); }} className="glass flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-2 text-left text-[12px] font-semibold text-white/85 transition hover:border-white/25 focus-visible:ring-2 focus-visible:ring-saffron/60 focus-visible:outline-none">
            <RotateCcw className="size-4 text-saffron-2" /> Reset View
          </button>
          <div className="glass rounded-2xl px-3.5 py-2.5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Map Layers</p>
            <div className="space-y-1.5">
              {LAYER_LABELS.map((l) => {
                const on = layers[l.id];
                return (
                  <button key={l.id} type="button" onClick={() => setLayers((s) => ({ ...s, [l.id]: !s[l.id] }))} className="flex w-full items-center gap-2 text-left text-[11.5px] text-white/70 transition hover:text-white focus-visible:outline-none">
                    <span className={cn("grid size-3.5 shrink-0 place-items-center rounded-[4px] border", on ? "border-saffron bg-saffron" : "border-white/30")}>
                      {on && <span className="size-1.5 rounded-[1px] bg-[#07122e]" />}
                    </span>
                    {l.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="glass rounded-2xl px-3.5 py-2.5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Survey Intensity</p>
            <div className="h-1.5 rounded-full bg-[linear-gradient(90deg,rgba(120,180,255,.35),#ffb866_60%,#ff7a1a)]" />
            <div className="mt-1.5 flex justify-between text-[9.5px] uppercase tracking-[0.14em] text-white/35"><span>Low</span><span>High</span></div>
          </div>
        </div>

        {/* RIGHT: analytics column */}
        <section className="relative z-20 mx-auto mt-4 max-w-xl rounded-3xl border border-white/10 bg-[#081127]/80 p-4 shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] backdrop-blur-2xl lg:absolute lg:right-[300px] lg:top-24 lg:mt-0 lg:w-[290px] lg:max-w-none">
          <PollToggle value={pollType} onChange={(v) => { setPollType(v); setActivePincode(null); }} />
          <div className="my-3.5 border-t border-dashed border-white/10" />
          <PollSummary scope={headline.scope} samples={headline.samples} results={headline.results} chip={headline.chip} />
          <div className="my-3.5 border-t border-dashed border-white/10" />
          <PollChart results={headline.results} centerLabel={activePin ? "PIN" : undefined} />
          <table className="mt-4 w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-[9.5px] uppercase tracking-[0.12em] text-white/35">
                <th className="pb-1.5 font-semibold">Party</th>
                <th className="pb-1.5 text-right font-semibold">Votes (est.)</th>
                <th className="pb-1.5 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {votes.map(({ key, votes: v }) => (
                <tr key={key} className="border-t border-white/[0.06]">
                  <td className="py-1.5">
                    <span className="flex items-center gap-2 text-white/75">
                      <span className="size-2 rounded-sm" style={{ background: PARTY_META[key].color }} />
                      {PARTY_META[key].label}
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-white/80">{v.toLocaleString("en-IN")}</td>
                  <td className="py-1.5 text-right tabular-nums font-semibold text-white">{headline.results[key]}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[10px] leading-relaxed text-white/30">MOCK DATA — vote estimates shown for demonstration only.</p>
        </section>

        {/* RIGHT: filter column */}
        <section className="relative z-20 mx-auto mt-4 flex max-w-xl flex-col rounded-3xl border border-white/10 bg-[#081127]/80 p-4 shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] backdrop-blur-2xl lg:absolute lg:bottom-8 lg:right-8 lg:top-24 lg:mt-0 lg:w-[248px] lg:max-w-none">
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 text-[12.5px] font-semibold">
            {(["districts", "pincodes"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setFilterTab(t)} className={cn("rounded-lg py-1.5 transition", filterTab === t ? "bg-white/[0.1] text-white" : "text-white/50 hover:text-white/80")}>
                {t === "districts" ? "Districts" : "PIN Codes"}
              </button>
            ))}
          </div>

          {filterTab === "districts" ? (
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
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <label className="relative mb-3 block">
                <input value={pinQuery} onChange={(e) => setPinQuery(e.target.value)} placeholder="Search PIN code..." aria-label="Search PIN codes" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-saffron/50 focus:bg-white/[0.07]" />
              </label>
              {!focusRow ? (
                <p className="px-1 py-6 text-center text-[12px] leading-relaxed text-white/45">Select a single district to reveal its PIN code survey points.</p>
              ) : (
                <div className="-mr-1 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  <p className="mb-2 px-1 text-[10.5px] uppercase tracking-[0.14em] text-white/40">{focusRow.district} · {focusRow.pincodes.length} PINs</p>
                  <ul className="space-y-0.5">
                    {filteredPins.map((p) => {
                      const lead = leadingParty(p.results);
                      const on = activePincode === p.pincode;
                      return (
                        <li key={p.pincode}>
                          <button
                            type="button"
                            onMouseEnter={() => setHoveredDistrict(null)}
                            onClick={() => { onSelectPincode(p.pincode); }}
                            className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition", on ? "bg-saffron/15 text-white" : "text-white/70 hover:bg-white/[0.06] hover:text-white")}
                          >
                            <span className="tabular-nums font-medium">{p.pincode}</span>
                            <span className="ml-auto text-[11px] text-white/40">{p.samples.toLocaleString("en-IN")}</span>
                            <span className="size-1.5 rounded-full" style={{ background: PARTY_META[lead].color }} title={`Leading: ${PARTY_META[lead].label}`} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* selected PIN detail (bottom-centre) */}
        {activePin && (
          <div className="relative z-20 mx-auto mt-4 w-full max-w-md rounded-2xl border border-white/10 bg-[#081127]/85 p-4 backdrop-blur-2xl lg:absolute lg:bottom-8 lg:left-1/2 lg:mt-0 lg:w-[420px] lg:-translate-x-1/2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-saffron-2">PIN Code · {activePin.district}</p>
            <div className="mt-1 flex items-end justify-between gap-4">
              <span className="font-display text-2xl font-semibold tabular-nums text-white">{activePin.pincode}</span>
              <span className="text-[12px] text-white/55">Survey samples: <b className="text-white/85">{activePin.samples.toLocaleString("en-IN")}</b></span>
            </div>
            <p className="mt-1 text-[11.5px] text-white/45">Leading party: <b style={{ color: PARTY_META[leadingParty(activePin.results)].color }}>{PARTY_META[leadingParty(activePin.results)].label}</b></p>
            <ul className="mt-3 space-y-1.5">
              {PARTY_ORDER.map((k) => (
                <li key={k} className="flex items-center gap-2 text-[11.5px]">
                  <span className="w-14 shrink-0 text-white/60">{PARTY_META[k].label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <span className="block h-full rounded-full" style={{ width: `${activePin.results[k]}%`, background: PARTY_META[k].color }} />
                  </span>
                  <span className="w-9 text-right tabular-nums text-white/85">{activePin.results[k]}%</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[9.5px] text-white/30">Pincode survey areas are visual approximations unless official polygon boundaries are available.</p>
          </div>
        )}
      </section>

      {/* ============ bottom preview cards ============ */}
      <section className="relative z-10 mx-auto max-w-[1720px] px-4 pb-16 pt-8 lg:px-6">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">How to explore</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {MODES.map(({ id, title, desc, Icon }, i) => (
            <button key={id} type="button" onClick={() => setMode2(id)} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left backdrop-blur-xl transition hover:border-white/20">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-serif text-2xl italic text-saffron-2">{String(i + 1).padStart(2, "0")}</span>
                <Icon className="size-4 text-white/40" />
              </div>
              <h3 className="font-display text-[15px] font-semibold">{title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-white/50">{desc}</p>
            </button>
          ))}
          <button type="button" onClick={() => { setMode2("district"); }} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left backdrop-blur-xl transition hover:border-white/20">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-serif text-2xl italic text-saffron-2">04</span>
              <MapPin className="size-4 text-white/40" />
            </div>
            <h3 className="font-display text-[15px] font-semibold">Multi-District View</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-white/50">Compare multiple districts together.</p>
          </button>
        </div>
      </section>
    </div>
  );
}
