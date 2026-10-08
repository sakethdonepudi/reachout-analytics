"use client";

import { useCallback, useMemo, useState } from "react";
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

export default function TamilNaduDashboard() {
  const { theme } = useTheme();
  const [pollType, setPollType] = useState<PollType>("exit");
  const [mode, setMode] = useState<MapMode>("state");
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [activeDistrict, setActiveDistrict] = useState<string | null>(null);
  const [activePincode, setActivePincode] = useState<string | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [resetNonce, setResetNonce] = useState(0);
  const [filterTab, setFilterTab] = useState<"districts" | "pincodes">("districts");
  const [layers, setLayers] = useState<MapLayers>({ boundaries: true, pins: true, labels: true, context: false });
  const [pinQuery, setPinQuery] = useState("");

  const dataset = useMemo(() => datasetFor(pollType), [pollType]);
  const allRows = useMemo(() => dataset.map((d) => ({ name: d.district, samples: d.samples })), [dataset]);
  const activePin = useMemo(() => (activePincode ? findPincode(activePincode, pollType) : undefined), [activePincode, pollType]);
  const focusRow = useMemo(() => (selectedDistricts.length === 1 ? dataset.find((d) => d.district === selectedDistricts[0]) : undefined), [selectedDistricts, dataset]);

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
    if (name) { setActiveDistrict(name); setSelectedDistricts([name]); setMode((m) => (m === "pincode" ? "district" : m)); }
    else { setActiveDistrict(null); setSelectedDistricts([]); setMode("state"); }
  }, []);

  const onSelectPincode = useCallback((pin: string | null) => { setActivePincode(pin); if (pin) setMode("pincode"); }, []);

  const crumbs: { label: string; onClick?: () => void }[] = [{ label: "Tamil Nadu", onClick: () => setMode2("state") }];
  if (focusRow) crumbs.push({ label: focusRow.district, onClick: () => { setActivePincode(null); setMode2("district"); } });
  if (activePincode) crumbs.push({ label: activePincode });

  const filteredPins = useMemo(() => {
    if (!focusRow) return [];
    const q = pinQuery.trim();
    return focusRow.pincodes.filter((p) => !q || p.pincode.includes(q));
  }, [focusRow, pinQuery]);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_18%_8%,rgba(245,138,36,0.07),transparent_60%)]" aria-hidden />

      <section className="relative mx-auto max-w-[1720px] px-4 pb-4 pt-20 lg:h-[100svh] lg:min-h-[780px] lg:px-6">
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

        {/* map */}
        <div className="relative z-0 h-[56svh] min-h-[420px] lg:absolute lg:inset-0 lg:h-full">
          <TamilNaduMap
            pollType={pollType}
            districts={dataset}
            selectedDistricts={selectedDistricts}
            activeDistrict={activeDistrict}
            hoveredDistrict={hoveredDistrict}
            activePincode={activePincode}
            mode={mode}
            layers={layers}
            theme={theme}
            resetNonce={resetNonce}
            onHoverDistrict={setHoveredDistrict}
            onSelectDistrict={onMapSelectDistrict}
            onSelectPincode={onSelectPincode}
          />
        </div>

        {/* left: geography nav + controls */}
        <div className="relative z-20 mt-4 w-full max-w-[250px] space-y-2 lg:absolute lg:left-8 lg:top-[356px] lg:mt-0 lg:w-[240px] lg:max-h-[calc(100svh-376px)] lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]">
          <p className="px-1 text-[10.5px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Explore Geography</p>
          {MODES.map(({ id, title, desc, Icon }) => {
            const active = mode === id;
            return (
              <button key={id} type="button" onClick={() => setMode2(id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60",
                  active ? "border-saffron/60 bg-saffron/10" : "border-border bg-card/60 hover:border-saffron/40",
                )}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl border", active ? "border-saffron/40 bg-saffron/15 text-saffron-2" : "border-border bg-elevated text-muted-foreground")}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-foreground">{title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{desc}</span>
                </span>
              </button>
            );
          })}

          <div className="glass flex items-center gap-2.5 rounded-2xl px-3.5 py-2">
            <Layers className="size-4 text-saffron-2" />
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Selected</span>
            <span className="ml-auto font-display text-sm font-semibold text-foreground">{selectedDistricts.length} / {allRows.length}</span>
          </div>
          <button type="button" onClick={() => { setResetNonce((n) => n + 1); setMode2("state"); }}
            className="glass flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-2 text-left text-[12px] font-semibold text-foreground transition-colors hover:border-saffron/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
            <RotateCcw className="size-4 text-saffron-2" /> Reset View
          </button>

          <details className="glass rounded-2xl px-3.5 py-2.5" open>
            <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Map Layers</summary>
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
          <div className="glass rounded-2xl px-3.5 py-2.5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Survey Intensity</p>
            <div className="h-1.5 rounded-full bg-[linear-gradient(90deg,var(--map-line),#f58a24)] opacity-80" />
            <div className="mt-1.5 flex justify-between text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground"><span>Low</span><span>High</span></div>
          </div>
        </div>

        {/* right: analytics */}
        <section className="relative z-20 mx-auto mt-4 max-w-xl rounded-3xl border border-border bg-card/85 p-4 shadow-[0_24px_60px_-30px_rgba(15,20,30,0.5)] backdrop-blur-2xl lg:absolute lg:right-[300px] lg:top-24 lg:mt-0 lg:w-[290px] lg:max-w-none">
          <PollToggle value={pollType} onChange={(v) => { setPollType(v); setActivePincode(null); }} />
          <div className="my-3.5 border-t border-dashed border-border" />
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
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">MOCK DATA — vote estimates shown for demonstration only.</p>
        </section>

        {/* right: filters */}
        <section className="relative z-20 mx-auto mt-4 flex max-w-xl flex-col rounded-3xl border border-border bg-card/85 p-4 shadow-[0_24px_60px_-30px_rgba(15,20,30,0.5)] backdrop-blur-2xl lg:absolute lg:bottom-8 lg:right-8 lg:top-24 lg:mt-0 lg:w-[248px] lg:max-w-none">
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-border bg-elevated/50 p-1 text-[12.5px] font-semibold">
            {(["districts", "pincodes"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setFilterTab(t)} className={cn("rounded-lg py-1.5 transition-colors", filterTab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
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
              onActivate={(name) => { if (!name) { setActiveDistrict(null); setActivePincode(null); return; } setActiveDistrict(selectedDistricts.includes(name) ? null : name); setActivePincode(null); }}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <label className="relative mb-3 block">
                <input value={pinQuery} onChange={(e) => setPinQuery(e.target.value)} placeholder="Search PIN code..." aria-label="Search PIN codes" className="w-full rounded-xl border border-border bg-elevated/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-saffron/60 focus:ring-2 focus:ring-saffron/20" />
              </label>
              {!focusRow ? (
                <p className="px-1 py-6 text-center text-[12px] leading-relaxed text-muted-foreground">Select a single district to reveal its PIN code survey points.</p>
              ) : (
                <div className="-mr-1 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  <p className="mb-2 px-1 text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">{focusRow.district} · {focusRow.pincodes.length} PINs</p>
                  <ul className="space-y-0.5">
                    {filteredPins.map((p) => {
                      const lead = leadingParty(p.results);
                      const on = activePincode === p.pincode;
                      return (
                        <li key={p.pincode}>
                          <button type="button" onMouseEnter={() => setHoveredDistrict(null)} onClick={() => onSelectPincode(p.pincode)}
                            className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition-colors", on ? "bg-saffron/15 text-foreground" : "text-foreground/75 hover:bg-elevated hover:text-foreground")}>
                            <span className="tabular-nums font-medium">{p.pincode}</span>
                            <span className="ml-auto text-[11px] text-muted-foreground">{p.samples.toLocaleString("en-IN")}</span>
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

        {/* selected PIN detail */}
        {activePin && (
          <div className="relative z-20 mx-auto mt-4 w-full max-w-md rounded-2xl border border-border bg-card/90 p-4 backdrop-blur-2xl lg:absolute lg:bottom-8 lg:left-1/2 lg:mt-0 lg:w-[420px] lg:-translate-x-1/2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-saffron-2">PIN Code · {activePin.district}</p>
            <div className="mt-1 flex items-end justify-between gap-4">
              <span className="font-display text-2xl font-semibold tabular-nums text-foreground">{activePin.pincode}</span>
              <span className="text-[12px] text-muted-foreground">Survey samples: <b className="text-foreground/85">{activePin.samples.toLocaleString("en-IN")}</b></span>
            </div>
            <p className="mt-1 text-[11.5px] text-muted-foreground">Leading party: <b style={{ color: PARTY_META[leadingParty(activePin.results)].color }}>{PARTY_META[leadingParty(activePin.results)].label}</b></p>
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
            <p className="mt-2 text-[9.5px] text-muted-foreground">Pincode survey areas are visual approximations unless official polygon boundaries are available.</p>
          </div>
        )}
      </section>

      {/* bottom preview cards */}
      <section className="relative z-10 mx-auto max-w-[1720px] px-4 pb-16 pt-8 lg:px-6">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">How to explore</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {MODES.map(({ id, title, desc, Icon }, i) => (
            <button key={id} type="button" onClick={() => setMode2(id)} className="rounded-2xl border border-border bg-card/60 p-4 text-left backdrop-blur-xl transition-colors hover:border-saffron/40">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-serif text-2xl italic text-saffron-2">{String(i + 1).padStart(2, "0")}</span>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <h3 className="font-display text-[15px] font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{desc}</p>
            </button>
          ))}
          <button type="button" onClick={() => setMode2("district")} className="rounded-2xl border border-border bg-card/60 p-4 text-left backdrop-blur-xl transition-colors hover:border-saffron/40">
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
