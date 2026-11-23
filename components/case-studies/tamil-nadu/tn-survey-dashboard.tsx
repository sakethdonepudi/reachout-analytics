"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowDownToLine, ArrowLeft, ChevronDown, Megaphone, RotateCcw } from "lucide-react";
import PartyCard from "@/components/case-studies/shared/party-card";
import TnSocialMedia from "./tn-social-media";
import type { SocialFilter } from "@/lib/survey/social-types";
import TnProfileTable, { TN_PARTY_COLORS, weightedAiadminAverage } from "./tn-profile-table";
import type { SurveyData, SurveyPeriod, SurveyShare } from "@/lib/survey/types";
import { accuracyAgainst, surveySlots } from "@/lib/survey/tn-shared";
import type { TnSerializedMap, TnSwingPayload } from "@/lib/survey/tn-view-dto";
import { TN_2021_BASE } from "@/lib/tamil-nadu/baseline";
import { canonicalDistrictName } from "@/lib/tamil-nadu/aliases";
import { cn } from "@/lib/utils";

const TamilNaduMap = dynamic(() => import("./tamil-nadu-map"), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[420px] w-full place-items-center text-[12px] text-[#6B6B6B]">Loading map...</div>,
});

const int = (value: number) => new Intl.NumberFormat("en-IN").format(Math.round(value));
const pct = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`);
const signed = (value: number) => `${Math.abs(value) < 0.05 ? "0.0" : value > 0 ? "+" : ""}${value.toFixed(1)}pp`;
const COLOR = TN_PARTY_COLORS;
const colour = (party: string) => COLOR[party] ?? "#64748B";
const STATE = "Tamil Nadu";
const GROUP_KEY: Record<string, string> = { TVK: "TVK", "DMK+": "DMK+INC+VCK", "AIADMK+": "AIADMK+BJP+PMK+AMMK", NTK: "NTK", Others: "Others" };
const MAJORITY = 118;

const PROFILE_ORDER: Record<string, string[]> = {
  op: ["age", "caste", "prof", "zone", "dist", "ac", "v21", "app"],
  ex: ["zone", "dist", "ac", "v21", "age", "caste", "prof", "form", "religion", "app"],
};

type SearchState = { view: string; slot: string; profile: string };

function searchFrom(state: SearchState) {
  const params = new URLSearchParams();
  params.set("view", state.view);
  if (state.view === "op" || state.view === "ex") params.set("slot", state.slot || "all");
  else params.delete("slot");
  if (state.profile) params.set("profile", state.profile);
  return params;
}

function leaderOf(shares: SurveyShare | null | undefined, parties: string[]) {
  if (!shares) return null;
  return [...parties].sort((a, b) => (shares[b] ?? 0) - (shares[a] ?? 0))[0] ?? null;
}

function seatParties(seats: Record<string, unknown>, parties: string[]) {
  return parties.filter((party) => typeof seats[party] === "number");
}

function seatTotal(seats: Record<string, unknown>, parties: string[]) {
  return seatParties(seats, parties).reduce((sum, party) => sum + Number(seats[party] ?? 0), 0);
}


function SocialIcons({ active }: { active: boolean }) {
  const opacity = active ? 0.95 : 0.8;
  return (
    <>
      <svg viewBox="0 0 24 24" className="size-4" fill="#1877F2" opacity={opacity}><path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.7V4.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.4V14h2.7v8h3.4Z"/></svg>
      <svg viewBox="0 0 24 24" className="size-4" fill="#C13584" opacity={opacity}><circle cx="12" cy="12" r="4.1" fill="none" stroke="#C13584" strokeWidth="2"/><circle cx="17.6" cy="6.4" r="1.2" fill="#C13584"/><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill="none" stroke="#C13584" strokeWidth="2"/></svg>
      <svg viewBox="0 0 24 24" className="size-4" fill="#FF0000" opacity={opacity}><rect x="2.5" y="5.2" width="19" height="13.6" rx="3.2"/><path d="M10 9.2v5.6l4.8-2.8L10 9.2Z" fill="#fff"/></svg>
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="#15803D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity={opacity}><path d="M4 16.5 10 10l3.5 3.5L20 7"/><path d="M14.5 7H20v5.5"/></svg>
    </>
  );
}

function Section({ title, note, children, className }: { title: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-[#EAEAEA] bg-white p-4 sm:p-5", className)} aria-label={title}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[17px] font-semibold leading-tight text-[#0B0B0C]">{title}</h3>
        {note && <p className="text-[10px] text-[#6B6B6B]">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export default function TnSurveyDashboard({
  data,
  owner,
  initialView,
  initialSlot,
  initialProfile,
  initialSocialFilter,
  map,
  swing,
}: {
  data: SurveyData;
  owner: boolean;
  initialView: "op" | "ex" | "rs" | "social";
  initialSlot?: string | null;
  initialProfile?: string | null;
  initialSocialFilter?: SocialFilter | null;
  map: TnSerializedMap | null;
  swing: TnSwingPayload;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView] = useState(initialView);
  const [slotKey, setSlotKey] = useState(initialSlot ?? "all");
  const [profileKey, setProfileKey] = useState(initialProfile ?? "");
  const [district, setDistrict] = useState<string | null>(null);
  const [acNo, setAcNo] = useState<number | null>(null);
  const [mapMode, setMapMode] = useState<"district" | "assembly">("district");
  const [swingPeriod, setSwingPeriod] = useState<"op" | "ex">("op");
  const [swingSlot, setSwingSlot] = useState("all");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setView(initialView);
    setSlotKey(initialSlot ?? "all");
    setProfileKey(initialProfile ?? "");
  }, [initialView, initialSlot, initialProfile]);

  const periodKey = view === "social" ? "op" : view;
  const period = data.periods[periodKey] ?? data.periods.op;
  const mapBuild = map;
  const slot = mapBuild?.slot ?? { key: "all", label: period?.label ?? "", periodKey, slotKey: "all", n: period?.n ?? 0, from: period?.from ?? "", to: period?.to ?? "", demo: {}, expected: period?.expected ?? {}, seats: period?.seats ?? {} };
  const parties = data.parties;
  const expected = slot.expected[STATE] ?? {};
  const actual = data.actual[STATE] ?? {};
  const seats = period.seats ?? {};
  const leadParty = leaderOf(expected, parties);
  const accuracy = view === "rs" ? null : accuracyAgainst(expected, actual, parties);
  const slotN = slot.n;
  const subPeriodMonth = period.months?.[slotKey] ? slotKey : Object.entries(period.months ?? {}).find(([, month]) => month.sub?.[slotKey])?.[0] ?? null;
  const subPeriodRow = subPeriodMonth ? Object.entries(period.months?.[subPeriodMonth]?.sub ?? {}) : [];
  const profiles = useMemo(() => {
    const demos = slot.demo ?? {};
    const catalog = slot.demoCatalog ?? {};
    const available = new Set([...Object.keys(demos), ...Object.keys(catalog)]);
    const order = ({ op: ["age", "caste", "prof", "zone", "dist", "ac", "v21", "app"], ex: ["zone", "dist", "ac", "v21", "age", "caste", "prof", "form", "religion", "app"] } as Record<string, string[]>)[periodKey] ?? [];
    const keys = order.filter((key) => available.has(key));
    for (const key of available) if (!keys.includes(key)) keys.push(key);
    return keys;
  }, [periodKey, slot.demo, slot.demoCatalog]);
  const activeProfile = profiles.includes(profileKey) ? profileKey : profiles[0] ?? "";
  const demo = activeProfile ? slot.demo[activeProfile] : null;
  const average = demo ? weightedAiadminAverage(demo.rows, parties) : 0;

  const navigate = useCallback((next: Partial<SearchState> & { filter?: SocialFilter | null }) => {
    const state: SearchState = {
      view: next.view ?? view,
      slot: next.slot ?? slotKey,
      profile: next.profile ?? profileKey,
    };
    const params = searchFrom(state);
    if (next.filter) {
      params.set("match", next.filter.match);
      if (next.filter.kind) params.set("kind", next.filter.kind);
      if (next.filter.place) params.set("place", next.filter.place);
      if (next.filter.label) params.set("label", next.filter.label);
      if (next.filter.value) params.set("value", next.filter.value);
      if (next.filter.average) params.set("average", next.filter.average);
      if (next.filter.group) params.set("group", next.filter.group);
    }
    const y = window.scrollY;
    try { sessionStorage.setItem("ro:tn-survey-scroll", JSON.stringify({ view: state.view, slot: state.slot, profile: state.profile, y })); } catch { /* storage can be blocked */ }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, profileKey, router, slotKey, view]);

  const openSocial = useCallback((filter?: SocialFilter) => {
    if (!filter) { navigate({ view: "social" }); return; }
    navigate({ view: "social", filter });
  }, [navigate]);

  const closeSocial = useCallback(() => {
    let saved = { view: "op", slot: "all", profile: "", y: 0 };
    try { saved = { ...saved, ...JSON.parse(sessionStorage.getItem("ro:tn-survey-scroll") ?? "{}") }; } catch { /* storage can be blocked */ }
    navigate({ view: saved.view, slot: saved.slot, profile: saved.profile });
    requestAnimationFrame(() => window.scrollTo({ top: saved.y }));
  }, [navigate]);

  async function download() {
    setDownloading(true);
    try {
      const response = await fetch("/api/survey/download?state=tamil-nadu");
      if (!response.ok) throw new Error("That data could not be downloaded.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "tamil-nadu-survey-export.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const periodCards = (["op", "ex", "rs"] as const).map((key) => {
    const item = data.periods[key];
    if (!item) return null;
    const shares = key === "rs" ? data.actual[STATE] ?? {} : item.expected[STATE] ?? {};
    const acc = key === "rs" ? null : accuracyAgainst(shares, actual, parties);
    return {
      key,
      label: item.label.replace(/\s*\(.*/, ""),
      shares,
      accuracy: acc,
    };
  });

  return (
    <main className="relative min-h-0 bg-white text-[var(--p-ink)]">
      <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/case-studies" className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#CFCFCF] bg-white px-3 py-1.5 text-[12px] text-[#6B6B6B] transition-colors hover:border-[#0B0B0C] hover:text-[#0B0B0C]">
            <ArrowLeft className="size-3.5" /> Back to Case Studies
          </Link>
          {owner && (
            <button type="button" onClick={() => void download()} disabled={downloading} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#0B0B0C] px-3 text-[11px] font-semibold text-[#0B0B0C] hover:bg-[#0B0B0C] hover:text-white disabled:opacity-50">
              <ArrowDownToLine className="size-3.5" /> {downloading ? "Preparing..." : "Download data"}
            </button>
          )}
        </div>

        <header className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
            <PartyCard party="AIADMK" state="Tamil Nadu" className="w-auto sm:min-w-[190px]" />
            <div className="min-w-0">
              <h1 className="font-display text-[20px] font-semibold leading-tight tracking-[-0.02em] text-[#0B0B0C] sm:text-[24px]">Tamil Nadu · Opinion, Exit & Result Survey Analysis</h1>
              <p className="mt-1 text-[12px] text-[#555]">{int(data.n_total)} responses · Opinion poll {data.periods.op?.from ?? "—"} to {data.periods.op?.to ?? "—"} · Exit poll {data.periods.ex?.from ?? "—"} to {data.periods.ex?.to ?? "—"}</p>
            </div>
          </div>
          <Link href="/case-studies/tamil-nadu" className="text-[11px] font-semibold text-[#6B6B6B] hover:text-[#0B0B0C]">Reset view</Link>
        </header>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {periodCards.map((card) => card && (
            <button key={card.key} type="button" aria-pressed={view === card.key} onClick={() => { setDistrict(null); setAcNo(null); navigate({ view: card.key, slot: "all", profile: "" }); }}
              className={cn("rounded-xl border-2 p-3 text-left transition-colors", view === card.key ? "border-[#002147] bg-[#002147] text-white shadow-[0_0_0_2px_white,0_0_0_4px_#002147]" : "border-[#D5D8DE] bg-[#F7F8FA] text-[#0B0B0C] hover:border-[#9AA3AF]")}>
              <p className="text-[12px] font-bold">{card.label}</p>
              <p className={cn("mt-1 text-[10px] font-semibold", view === card.key ? "text-white/90" : "text-[#555]")}>{parties.slice(0, 3).map((party) => `${party} ${pct(card.shares[party])}`).join(" · ")}</p>
              {card.accuracy != null && <p className={cn("mt-1 text-[10px] font-bold", view === card.key ? "text-[#4ade80]" : "text-[#15803D]")}>accuracy {card.accuracy.toFixed(1)}%</p>}
              {card.key === "rs" && <p className={cn("mt-1 text-[10px]", view === card.key ? "text-white/80" : "text-[#555]")}>TVK 108 · DMK+ 73 · AIADMK+ 53</p>}
            </button>
          ))}
          <button type="button" aria-pressed={view === "social"} onClick={() => openSocial()} className={cn("rounded-xl border-2 p-3 text-left transition-colors", view === "social" ? "border-[#1877F2] bg-[#002147] text-white shadow-[0_0_0_2px_white,0_0_0_4px_#1877F2]" : "border-[#D5D8DE] bg-[#F7F8FA] text-[#0B0B0C] hover:border-[#9AA3AF]")}>
            <div className="flex items-start justify-between gap-2">
              <p className="flex items-center gap-2 text-[12px] font-bold"><Megaphone className="size-4" /> Social Media</p>
              <span className="flex items-center gap-1.5" aria-hidden><SocialIcons active={view === "social"} /></span>
            </div>
            <p className={cn("mt-1 text-[10px] font-semibold", view === "social" ? "text-white/80" : "text-[#555]")}>Ads · reach & engagement</p>
          </button>
        </div>

        {view !== "social" && view !== "rs" && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Survey time slot">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8C6A2F]">{view === "ex" ? "Day" : "Month"}</span>
            {surveySlots(data, view).filter((item) => !item.subKey).map((item) => {
              const source = item.monthKey ? period.months?.[item.monthKey] : period;
              const itemShares = source?.expected[STATE] ?? expected;
              const lead = leaderOf(itemShares, parties) ?? "TVK";
              const subs = item.monthKey ? Object.entries(period.months?.[item.monthKey]?.sub ?? {}) : [];
              return (
                <div key={item.key} className="relative">
                  <button type="button" aria-pressed={slotKey === item.key} onClick={() => navigate({ slot: item.key, profile: "" })}
                    title={parties.slice(0, 4).map((party) => `${party} ${pct(itemShares[party])}`).join(" · ")}
                    className={cn("min-h-8 rounded-full border px-3 text-[10.5px] font-semibold transition-colors", slotKey === item.key ? "border-[#002147] shadow-[0_0_0_2px_white,0_0_0_3.5px_#002147]" : "border-[#C9CDD4] hover:border-[#0B0B0C]")}
                    style={{ background: slotKey === item.key ? colour(lead) : `${colour(lead)}22`, color: slotKey === item.key ? "#fff" : "#1f2937" }}>
                    {item.label}{subs.length ? <ChevronDown className="ml-1 inline size-3" /> : null}
                  </button>
                </div>
              );
            })}
            {subPeriodRow.length > 0 && (
              <div className="mt-1 flex w-full flex-wrap items-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-[#FAFAFA] px-2 py-1.5">
                <span className="mr-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#6B6B6B]">{period.months?.[subPeriodMonth ?? ""]?.label} sub-periods</span>
                {subPeriodRow.map(([key, sub]) => (
                  <button key={key} type="button" aria-pressed={slotKey === key} onClick={() => navigate({ slot: key, profile: "" })}
                    title={parties.slice(0, 4).map((party) => `${party} ${pct(sub.expected[STATE]?.[party])}`).join(" · ")}
                    className={cn("min-h-7 rounded-full border px-2.5 text-[10px] font-semibold", slotKey === key ? "border-[#002147] bg-[#002147] text-white" : "border-[#D5D8DE] bg-white text-[#1f2937] hover:border-[#0B0B0C]")}>
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "social" ? (
          <div className="mt-4"><TnSocialMedia stateSlug="tamil-nadu" initialFilter={initialSocialFilter} onClose={closeSocial} owner={owner} /></div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {parties.map((party) => {
                const value = view === "rs" ? (actual[party] ?? 0) : (expected[party] ?? 0);
                const perParty = view === "rs" ? null : Math.max(0, 100 - Math.abs(value - (actual[party] ?? 0)));
                return (
                  <div key={party} className="rounded-xl border border-[#EAEAEA] bg-white p-3" style={{ borderTopColor: colour(party), borderTopWidth: 3 }}>
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#555]"><span className="size-2 rounded-sm" style={{ background: colour(party) }} />{party} · {view === "rs" ? "actual" : view === "ex" ? "share" : "expected"}</p>
                    <p className="mt-1 font-display text-[26px] font-semibold leading-none tracking-[-0.02em] text-[#0B0B0C]">{value.toFixed(2)}%</p>
                    {view !== "rs" && <p className="mt-1 text-[10px] font-semibold text-[#B91C1C]">Actual 2026: {(actual[party] ?? 0).toFixed(2)}%</p>}
                    {perParty != null && <p className="mt-0.5 text-[10px] font-semibold text-[#15803D]">Accuracy {perParty.toFixed(1)}%</p>}
                  </div>
                );
              })}
            </div>
            {view !== "rs" && (
              <p className="mt-2 text-[12px] leading-relaxed text-[#555]"><b className="text-[#0B0B0C]">Note:</b> actual vs prediction, overall vote-share accuracy <b className="text-[#15803D]">{accuracy?.toFixed(1)}%</b> against the actual 2026 result ({parties.map((party) => `${party} ${(actual[party] ?? 0).toFixed(2)}%`).join(", ")}).</p>
            )}

            <div className="mt-2 rounded-xl border border-[#EAEAEA] bg-white p-3">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#F1F1F1]" role="img" aria-label={`Vote share bar for ${slot.label}`}>
                {parties.map((party) => <span key={party} style={{ width: `${Math.max(0, expected[party] ?? 0)}%`, background: colour(party) }} title={`${party} ${pct(expected[party])}`} />)}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#555]">
                {parties.map((party) => <span key={party} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: colour(party) }} />{party} {pct(expected[party])}</span>)}
                <span className="ml-auto text-[#15803D]">Lead key: {leadParty} ahead by {signed((expected[leadParty ?? ""] ?? 0) - (expected[[...parties].sort((a, b) => (expected[b] ?? 0) - (expected[a] ?? 0))[1] ?? ""] ?? 0))}</span>
              </div>
            </div>


            <section className="mt-3 rounded-2xl border border-[#EAEAEA] bg-white p-3 sm:p-4" aria-label="Tamil Nadu map">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-[16px] font-semibold text-[#0B0B0C]">{view === "rs" ? "Result 2026 by district" : `${slot.label} by ${mapMode === "district" ? "district" : "assembly"}`}</h2>
                  <p className="text-[10px] text-[#6B6B6B]">{view === "rs" ? "Actual seats from the uploaded Result period." : `${int(slotN)} responses · ${slot.from || "—"} to ${slot.to || "—"}`}</p>
                </div>
                {view !== "rs" && (
                  <div className="inline-flex rounded-full bg-[#F4F4F5] p-1" role="group" aria-label="Map detail">
                    {(["district", "assembly"] as const).map((mode) => (
                      <button key={mode} type="button" aria-pressed={mapMode === mode} onClick={() => setMapMode(mode)} className={cn("min-h-7 rounded-full px-2.5 text-[10px] font-semibold capitalize", mapMode === mode ? "bg-white text-[#0B0B0C] shadow-sm" : "text-[#6B6B6B]")}>{mode}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-2 h-[360px] overflow-hidden rounded-xl border border-[#EAEAEA] bg-[#FBFAF7] sm:h-[440px]">
                <TamilNaduMap
                  acs={mapBuild?.acs ?? []}
                  districts={mapBuild?.districts ?? []}
                  district={district}
                  acNo={acNo}
                  year="2026"
                  theme="light"
                  mode={mapMode}
                  fitKey={0}
                  onSelectDistrict={(name) => { setDistrict(name); setAcNo(null); }}
                  onSelectAc={(no) => setAcNo(no)}
                  onReset={() => { setDistrict(null); setAcNo(null); }}
                  tooltip={(payload) => {
                    const row = payload.kind === "district" ? mapBuild?.districtRows[canonicalDistrictName(payload.name)] : payload.no != null ? payload.no != null ? mapBuild?.acRows[String(payload.no)] : undefined : undefined;
                    if (view === "rs" && payload.kind === "district") {
                      const result = mapBuild?.resultRows[canonicalDistrictName(payload.name)];
                      if (!result) return { sub: "Result 2026 · No data", value: "No data", color: "#94A3B8" };
                      const top = Object.entries(result.seats).sort((a, b) => b[1] - a[1])[0];
                      return { sub: `Result 2026 · ${result.acs} ACs`, value: Object.entries(result.seats).map(([party, value]) => `${party} ${value}`).join(" · "), color: colour(top?.[0] ?? "") };
                    }
                    if (!row || !row.shares) return { sub: `${slot.label} · No data`, value: "No data", color: "#94A3B8" };
                    return {
                      sub: `${slot.label} · ${int(row.n)} responses`,
                      value: `${parties.map((party) => `${party} ${pct(((row.shares as Record<string, number> | null)?.[GROUP_KEY[party] ?? party] ?? 0) * 100)}`).join(" · ")}${row.marginPp == null ? "" : ` · lead ${row.marginPp.toFixed(1)} pp`}`,
                      color: colour(row.leader ?? ""),
                    };
                  }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#555]">
                {parties.map((party) => <span key={party} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-[2px] ring-1 ring-inset ring-black/10" style={{ background: colour(party) }} />{party}</span>)}
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-[2px] bg-[#94A3B8] ring-1 ring-inset ring-black/10" />No data / under 30</span>
                {(district || acNo != null) && <button type="button" onClick={() => { setDistrict(null); setAcNo(null); }} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0B0B0C] underline"><RotateCcw className="size-3" /> Reset map</button>}
              </div>
            </section>

            {view === "rs" ? (
              <ResultSection data={data} parties={parties} />
            ) : (
              <>
                {profiles.length > 0 && demo && (
                  <Section title={`Raw 2026 vote % by voter profile · ${slot.label}`} note={`${demo.label} · ${int(slotN)} responses`} className="mt-3">
                    <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Voter profile">
                      {profiles.map((key) => (
                        <button key={key} type="button" role="tab" aria-selected={activeProfile === key} onClick={() => navigate({ profile: key })} className={cn("min-h-8 rounded-full border px-2.5 text-[10px] font-semibold", activeProfile === key ? "border-[#8C6A2F] bg-[#FBF3DF] text-[#0B0B0C]" : "border-[#D5D8DE] text-[#555] hover:border-[#0B0B0C]")}>
                          {slot.demoCatalog?.[key]?.label ?? slot.demo[key]?.label ?? key}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2">
                      <TnProfileTable
                        demo={demo}
                        parties={parties}
                        profileKey={activeProfile}
                        periodKey={view}
                        slotLabel={slot.label}
                        average={average}
                        onTarget={(payload) => openSocial({ match: "target", kind: payload.kind, place: payload.place, label: `${payload.label} · ${payload.place} · AIADMK+ ${payload.value.toFixed(1)}% (average ${payload.average.toFixed(1)}%)`, value: String(payload.value), average: String(payload.average) })}
                        onCampaigns={(payload) => openSocial({ match: "campaigns", kind: payload.kind, place: payload.place, label: payload.place })}
                        onGroup={(group) => openSocial({ match: "group", group, label: group })}
                      />
                    </div>
                  </Section>
                )}
                <SwingSection data={data} swing={swing} parties={parties} period={swingPeriod} slot={swingSlot} onPeriod={(next) => { setSwingPeriod(next); setSwingSlot("all"); }} onSlot={setSwingSlot} />
                <SeatsByZone data={data} parties={parties} seats={seats} periodKey={view} slotLabel={slot.label} />
              </>
            )}

            <Section title="Method & caveats" className="mt-3">
              <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-[#555]">
                <li><b className="text-[#0B0B0C]">Data:</b> WPForms online surveys run through Meta ads. Opinion poll = the five TN Opinion Poll 2026 zone forms, 28 Mar to 7 May 2026, with a 2021-vote question. Exit poll = the seven TN Election Poll 2026 forms, mostly 23 to 29 Apr 2026. Polling day was 23 Apr 2026 and results were declared on 4 May 2026.</li>
                <li><b className="text-[#0B0B0C]">Opinion map:</b> the opinion and exit maps use the survey&apos;s deduplicated responses (n 67,211 for the opinion poll), so the header, map and profile tables always agree. The raw workbook was used to check the district shares.</li>
                <li><b className="text-[#0B0B0C]">Target Campaign flag:</b> shown under the AIADMK+ % in any profile row where AIADMK+ is below its weighted average for that table. It opens the matching campaigns in Social Media without any commercial figures.</li>
                <li><b className="text-[#0B0B0C]">Accuracy:</b> overall = 100 minus half the sum of the absolute gaps between survey % and actual 2026 %. Per party = 100 minus the gap in percentage points.</li>
                <li><b className="text-[#0B0B0C]">Late answers:</b> 87 exit-poll answers arrived after the result (up to 7 Oct 2026); they are kept so the total stays at 31,316.</li>
                <li><b className="text-[#0B0B0C]">Parties:</b> TVK; DMK+ = DMK, INC, VCK and allies; AIADMK+ = AIADMK, BJP, PMK, AMMK; NTK; Others. NOTA is shown in Others.</li>
                <li><b className="text-[#0B0B0C]">Expected % (opinion poll):</b> answers are weighted by the respondent&apos;s 2021 vote so the sample matches the actual 2021 ECI result in each zone, and zones are weighted by their 2021 votes. Exit poll figures are plain shares.</li>
                <li><b className="text-[#0B0B0C]">Raw %:</b> profile tables are unweighted shares of respondents. Groups under 30 answers are hidden.</li>
                <li><b className="text-[#0B0B0C]">Seat projection:</b> each AC&apos;s own survey shares plus the statewide shift, floored at 0; the party ahead wins. ACs with no answers take their zone&apos;s figure. Actual 2026: TVK 108, DMK+ 73, AIADMK+ 53.</li>
                <li><b className="text-[#0B0B0C]">Zones:</b> the five opinion-poll zones; each AC takes the zone its answers were filed under, and districts follow the 2026 ECI grouping. Exit-poll answers without an AC or district count only in the statewide figure.</li>
                <li><b className="text-[#0B0B0C]">2021 base:</b> official ECI AC results (alliance totals summed per zone). TVK did not contest in 2021, so its base is 0 and its swing equals its 2026 share.</li>
                <li><b className="text-[#0B0B0C]">Ads:</b> every Tamil Nadu campaign in the uploaded dashboard, grouped into survey periods. Commercial figures are never sent to the browser.</li>
              </ul>
            </Section>
          </>
        )}
      </div>
    </main>
  );
}

function SwingSection({ data, swing, parties, period, slot, onPeriod, onSlot }: { data: SurveyData; swing: TnSwingPayload; parties: string[]; period: "op" | "ex"; slot: string; onPeriod: (period: "op" | "ex") => void; onSlot: (slot: string) => void }) {
  const state = "Tamil Nadu";
  const sources = swing.sources[period] ?? [];
  const source = sources.find((item) => item.key === slot) ?? sources[0];
  const slots = sources;
  if (!source) return <Section title="Zone: 2021 → 2026 (swing)" className="mt-3"><p className="mt-2 text-[12px] text-[#6B6B6B]">No swing data in this upload.</p></Section>;
  return (
    <Section title="Zone: 2021 → 2026 (swing)" note={source.label} className="mt-3">
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {(["op", "ex"] as const).map((key) => <button key={key} type="button" aria-pressed={period === key} onClick={() => onPeriod(key)} className={cn("min-h-7 rounded-full border px-2.5 text-[10px] font-semibold", period === key ? "border-[#002147] bg-[#002147] text-white" : "border-[#D5D8DE] text-[#555]")}>{data.periods[key]?.label.replace(/\s*\(.*/, "") ?? key}</button>)}
        <select aria-label="Swing month" value={slot} onChange={(event) => onSlot(event.target.value)} className="min-h-7 rounded-full border border-[#D5D8DE] bg-white px-2 text-[10px] font-semibold text-[#555]">
          {slots.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-[#555]">Each cell shows the actual 2021 % (ECI, alliance totals) → the survey&apos;s {period === "ex" ? "2026 share" : "expected 2026 %"} (swing in percentage points). The Tamil Nadu row also shows the actual 2026 result. Zones with fewer than 30 located answers are left out.</p>
      <div className="mt-2 overflow-x-auto rounded-xl border border-[#EAEAEA]">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <thead className="bg-[#FAFAFA] text-left text-[11px] uppercase tracking-wide text-[#6B6B6B]"><tr><th className="px-3 py-2">Zone</th>{parties.map((party) => <th key={party} className="px-3 py-2 text-center">{party} 21→26</th>)}</tr></thead>
          <tbody>
            {data.regions.map((region) => {
              const before = data.base?.[region] ?? TN_2021_BASE[region];
              const after = source.expected[region];
              if (!before || !after) return null;
              return (
                <tr key={region} className={cn("border-t border-[#EAEAEA]", region === state && "font-bold")}>
                  <th scope="row" className="px-3 py-2 text-left">{data.zonelabels?.[region] ?? region}</th>
                  {parties.map((party) => {
                    const swing = (after[party] ?? 0) - (before[party] ?? 0);
                    return <td key={party} className="px-3 py-2 text-center tabular-nums">{pct(before[party])} → {pct(after[party])} <span className={cn("ml-1 rounded px-1 py-0.5 text-[10.5px] font-bold", swing > 0 ? "bg-[#DCFCE7] text-[#15803D]" : swing < 0 ? "bg-[#FEE2E2] text-[#B91C1C]" : "text-[#6B6B6B]")}>({signed(swing)})</span>{region === state && data.actual[region]?.[party] != null && <span className="mt-0.5 block text-[10.5px] font-bold text-[#B91C1C]">Actual 2026: {pct(data.actual[region][party])}</span>}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function SeatsByZone({ data, parties, seats, periodKey, slotLabel }: { data: SurveyData; parties: string[]; seats: Record<string, unknown>; periodKey: string; slotLabel: string }) {
  const zones = (seats.zones as Record<string, Record<string, unknown>> | undefined) ?? {};
  const actualZones = (data.periods.rs?.seats?.zones as Record<string, Record<string, unknown>> | undefined) ?? {};
  const actualSeats = data.periods.rs?.seats ?? {};
  const projected = seatTotal(seats, parties);
  const summaryParties = ["TVK", "DMK+", "AIADMK+", "NTK"];
  const actualParties = ["TVK", "DMK+", "AIADMK+"];
  const hit = typeof seats.hit === "number" ? seats.hit : null;
  const leader = leaderOf(data.periods.rs?.expected?.[STATE], parties);
  const majorityParty = leader && Number(actualSeats[leader] ?? 0) >= MAJORITY ? `${leader} majority` : "hung";
  const zoneRows = Object.entries(zones).map(([zone, row]) => ({ zone, row }));
  return (
    <Section title={`Seats by zone · 2026 projection · ${slotLabel}`} note={`${projected} of 234 seats · majority ${MAJORITY} · ${majorityParty}`} className="mt-3">
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {summaryParties.map((party) => (
          <div key={party} className="rounded-xl border border-[#EAEAEA] p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#555]"><span className="size-2 rounded-sm" style={{ background: colour(party) }} />{party}</p>
            <p className="mt-1 font-display text-[24px] font-semibold leading-none tabular-nums text-[#0B0B0C]">{int(Number(seats[party] ?? 0))}</p>
            <p className="mt-1 text-[10px] text-[#6B6B6B]">projected · actual {int(Number(actualSeats[party] ?? 0))}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-[#555]">Projection: {summaryParties.map((party) => `${party} ${int(Number(seats[party] ?? 0))}`).join(" · ")} of 234. Actual 2026: TVK 108 · DMK+ 73 · AIADMK+ 53.</p>
      {hit != null && <p className="mt-1 text-[12px] font-semibold text-[#0B0B0C]">The projected winner matches the actual winner in {int(hit)} of 234 ACs ({((hit / 234) * 100).toFixed(1)}%).</p>}
      <div className="mt-2 overflow-x-auto rounded-xl border border-[#EAEAEA]">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <thead className="bg-[#FAFAFA] text-left text-[11px] uppercase tracking-wide text-[#6B6B6B]">
            <tr><th rowSpan={2} className="px-3 py-2">Zone</th><th rowSpan={2} className="px-3 py-2 text-right">ACs</th><th colSpan={4} className="px-3 py-2 text-center">Projected</th><th colSpan={3} className="px-3 py-2 text-center">Actual 2026</th></tr>
            <tr>{summaryParties.map((party) => <th key={party} className="px-3 py-2 text-right">{party}</th>)}{actualParties.map((party) => <th key={party} className="px-3 py-2 text-right">{party}</th>)}</tr>
          </thead>
          <tbody>
            {zoneRows.map(({ zone, row }) => (
              <tr key={zone} className="border-t border-[#EAEAEA]">
                <th scope="row" className="px-3 py-2 text-left font-semibold">{data.zonelabels?.[zone] ?? zone}</th>
                <td className="px-3 py-2 text-right tabular-nums">{int(Number(row.acs ?? 0))}</td>
                {summaryParties.map((party) => <td key={party} className="px-3 py-2 text-right tabular-nums">{int(Number(row[party] ?? 0))}</td>)}
                {actualParties.map((party) => <td key={party} className="px-3 py-2 text-right tabular-nums">{int(Number(actualZones[zone]?.[party] ?? 0))}</td>)}
              </tr>
            ))}
            <tr className="border-t-2 border-[#0B0B0C] font-bold">
              <th scope="row" className="px-3 py-2 text-left">Tamil Nadu</th>
              <td className="px-3 py-2 text-right tabular-nums">234</td>
              {summaryParties.map((party) => <td key={party} className="px-3 py-2 text-right tabular-nums">{int(Number(seats[party] ?? 0))}</td>)}
              {actualParties.map((party) => <td key={party} className="px-3 py-2 text-right tabular-nums">{int(Number(actualSeats[party] ?? 0))}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[10px] text-[#6B6B6B]">{periodKey === "rs" ? "Actual seats by zone." : "Projected winner calls compared with the actual 2026 winners."}</p>
    </Section>
  );
}

function ResultSection({ data, parties }: { data: SurveyData; parties: string[] }) {
  const state = "Tamil Nadu";
  const actual = data.actual[state] ?? {};
  const op = data.periods.op?.expected[state] ?? {};
  const ex = data.periods.ex?.expected[state] ?? {};
  const rsSeats = data.periods.rs?.seats ?? {};
  const opSeats = data.periods.op?.seats ?? {};
  const exSeats = data.periods.ex?.seats ?? {};
  const actualZones = (data.periods.rs?.seats?.zones as Record<string, Record<string, unknown>> | undefined) ?? {};
  const districts = data.periods.rs?.dist ?? [];
  const mape = (shares: SurveyShare) => (["TVK", "DMK+", "AIADMK+", "NTK"].reduce((sum, party) => sum + Math.abs((shares[party] ?? 0) - (actual[party] ?? 0)) / ((actual[party] ?? 1) || 1), 0) / 4 * 100).toFixed(1);
  const seatRow = (label: string, seats: Record<string, unknown>, extra = false) => (
    <tr className={cn("border-t border-[#EAEAEA]", extra && "font-bold")}>
      <th scope="row" className="px-2 py-1.5 text-left">{label}</th>
      {["TVK", "DMK+", "AIADMK+"].map((party) => <td key={party} className="px-2 py-1.5 text-right tabular-nums">{int(Number(seats[party] ?? 0))}{!extra && <span className="ml-1 text-[10.5px] text-[#6B6B6B]">({signed(Number(seats[party] ?? 0) - Number(rsSeats[party] ?? 0)).replace("pp", "")})</span>}</td>)}
      <td className="px-2 py-1.5 text-right tabular-nums">{extra ? "234 / 234" : `${int(Number(seats.hit ?? 0))} / 234`}</td>
    </tr>
  );
  return (
    <Section title="Result 2026 vs survey projections" note="Actual: ECI result declared 4 May 2026" className="mt-3">
      <p className="mt-1 text-[12px] text-[#555]">Actual: TVK won 108 seats with {pct(actual.TVK)} of the vote; DMK+ 73 ({pct(actual["DMK+"])}); AIADMK+ 53 ({pct(actual["AIADMK+"])}); NTK 0 ({pct(actual.NTK)}). Chips show survey minus actual.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {["TVK", "DMK+", "AIADMK+"].map((party) => <div key={party} className="rounded-xl border border-[#EAEAEA] p-3"><p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#555]"><span className="size-2 rounded-sm" style={{ background: colour(party) }} />{party}</p><p className="mt-0.5 text-[22px] font-semibold tabular-nums">{int(Number(rsSeats[party] ?? 0))}</p><p className="text-[11px] text-[#6B6B6B]">seats · {pct(actual[party])} votes</p></div>)}
        <div className="rounded-xl border border-[#EAEAEA] p-3"><p className="text-[10px] font-semibold text-[#555]">Majority</p><p className="mt-0.5 text-[22px] font-semibold tabular-nums">118</p><p className="text-[11px] text-[#6B6B6B]">TVK short by {MAJORITY - Number(rsSeats.TVK ?? 0)}</p></div>
      </div>
      <h4 className="mt-3 text-[12px] font-semibold text-[#0B0B0C]">Vote share</h4>
      <div className="mt-1 overflow-x-auto rounded-xl border border-[#EAEAEA]">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead className="bg-[#FAFAFA] text-left text-[11px] uppercase tracking-wide text-[#6B6B6B]"><tr><th className="px-2 py-2">Source</th>{parties.map((party) => <th key={party} className="px-2 py-2 text-right">{party}</th>)}<th className="px-2 py-2 text-right">MAPE (4 parties)</th></tr></thead>
          <tbody>
            {[{ label: "Opinion poll · expected", shares: op }, { label: "Exit poll · share", shares: ex }, { label: "Actual 2026", shares: actual, extra: true }].map((row) => (
              <tr key={row.label} className={cn("border-t border-[#EAEAEA]", row.extra && "font-bold")}><th scope="row" className="px-2 py-1.5 text-left">{row.label}</th>{parties.map((party) => <td key={party} className="px-2 py-1.5 text-right tabular-nums">{pct(row.shares[party])}{!row.extra && <span className="ml-1 text-[10.5px] text-[#6B6B6B]">({signed((row.shares[party] ?? 0) - (actual[party] ?? 0))})</span>}</td>)}<td className="px-2 py-1.5 text-right tabular-nums">{row.extra ? "—" : `${mape(row.shares)}%`}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4 className="mt-3 text-[12px] font-semibold text-[#0B0B0C]">Seats</h4>
      <div className="mt-1 overflow-x-auto rounded-xl border border-[#EAEAEA]">
        <table className="w-full min-w-[560px] border-collapse text-[13px]">
          <thead className="bg-[#FAFAFA] text-left text-[11px] uppercase tracking-wide text-[#6B6B6B]"><tr><th className="px-2 py-2">Source</th>{["TVK", "DMK+", "AIADMK+"].map((party) => <th key={party} className="px-2 py-2 text-right">{party}</th>)}<th className="px-2 py-2 text-right">ACs with the right winner</th></tr></thead>
          <tbody>{seatRow("Opinion poll projection", opSeats)}{seatRow("Exit poll projection", exSeats)}{seatRow("Actual 2026", rsSeats, true)}</tbody>
        </table>
      </div>
      <h4 className="mt-3 text-[12px] font-semibold text-[#0B0B0C]">Actual seats by zone</h4>
      <div className="mt-1 overflow-x-auto rounded-xl border border-[#EAEAEA]">
        <table className="w-full min-w-[520px] border-collapse text-[13px]">
          <thead className="bg-[#FAFAFA] text-left text-[11px] uppercase tracking-wide text-[#6B6B6B]"><tr><th className="px-2 py-2">Zone</th><th className="px-2 py-2 text-right">ACs</th>{["TVK", "DMK+", "AIADMK+"].map((party) => <th key={party} className="px-2 py-2 text-right">{party}</th>)}<th className="px-2 py-2 text-right">Top</th></tr></thead>
          <tbody>
            {Object.entries(actualZones).map(([zone, row]) => {
              const top = ["TVK", "DMK+", "AIADMK+"].sort((a, b) => Number(row[b] ?? 0) - Number(row[a] ?? 0))[0];
              return <tr key={zone} className="border-t border-[#EAEAEA]"><th scope="row" className="px-2 py-1.5 text-left">{data.zonelabels?.[zone] ?? zone}</th><td className="px-2 py-1.5 text-right tabular-nums">{int(Number(row.acs ?? 0))}</td>{["TVK", "DMK+", "AIADMK+"].map((party) => <td key={party} className="px-2 py-1.5 text-right tabular-nums">{int(Number(row[party] ?? 0))}</td>)}<td className="px-2 py-1.5 text-right"><span className="mr-1 inline-block size-1.5 rounded-sm" style={{ background: colour(top) }} />{top}</td></tr>;
            })}
          </tbody>
        </table>
      </div>
      <h4 className="mt-3 text-[12px] font-semibold text-[#0B0B0C]">Actual seats by district</h4>
      <div className="mt-1 max-h-[420px] overflow-auto rounded-xl border border-[#EAEAEA]">
        <table className="w-full min-w-[520px] border-collapse text-[13px]">
          <thead className="sticky top-0 bg-[#FAFAFA] text-left text-[11px] uppercase tracking-wide text-[#6B6B6B]"><tr><th className="px-2 py-2">District</th><th className="px-2 py-2 text-right">ACs</th>{["TVK", "DMK+", "AIADMK+"].map((party) => <th key={party} className="px-2 py-2 text-right">{party}</th>)}<th className="px-2 py-2 text-right">Top</th></tr></thead>
          <tbody>
            {districts.map((row) => {
              const top = ["TVK", "DMK+", "AIADMK+"].sort((a, b) => Number(row[b] ?? 0) - Number(row[a] ?? 0))[0];
              return <tr key={row.d} className="border-t border-[#EAEAEA]"><th scope="row" className="px-2 py-1.5 text-left">{row.d}</th><td className="px-2 py-1.5 text-right tabular-nums">{int(row.acs)}</td>{["TVK", "DMK+", "AIADMK+"].map((party) => <td key={party} className="px-2 py-1.5 text-right tabular-nums">{int(Number(row[party] ?? 0))}</td>)}<td className="px-2 py-1.5 text-right"><span className="mr-1 inline-block size-1.5 rounded-sm" style={{ background: colour(top) }} />{top}</td></tr>;
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
