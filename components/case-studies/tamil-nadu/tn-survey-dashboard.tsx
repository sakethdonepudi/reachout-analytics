"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowDownToLine, ArrowLeft, ChevronDown, Megaphone } from "lucide-react";
const TnSocialMedia = dynamic(() => import("./tn-social-media"), {
  ssr: false,
  loading: () => <div className="rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-8 text-[14px] text-[color:var(--theme-text-3)]">Preparing the social view...</div>,
});
import type { SocialFilter, TnSocialOverview } from "@/lib/survey/social-types";
import TnProfileTable, { weightedAiadminAverage } from "./tn-profile-table";
import { PartyBadge } from "./party-badge";
import type { SurveyDemo, SurveyShare } from "@/lib/survey/types";
import type { TnClientModel, TnSerializedMap, TnSlotModel, TnSwingPayload } from "@/lib/survey/tn-view-model";
import { TN_2021_BASE } from "@/lib/tamil-nadu/baseline";
import { canonicalDistrictName } from "@/lib/tamil-nadu/aliases";
import { partyColour, partyNeedsWhiteInk, TN_GROUP_KEY } from "@/lib/tamil-nadu/party-brand";
import { projectedMajority } from "@/lib/tamil-nadu/majority";
import { swingLabel, swingTone } from "@/lib/tamil-nadu/swing";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import { cn } from "@/lib/utils";
import { SocialCluster } from "./social-icons";
import { TrendChart } from "./trend-chart";
import { useTheme } from "@/components/site/theme";

const TamilNaduMap = dynamic(() => import("./tamil-nadu-map"), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[420px] w-full place-items-center text-[14px] text-[color:var(--theme-text-3)]">Loading map...</div>,
});

const int = (value: number) => new Intl.NumberFormat("en-IN").format(Math.round(value));
const pct = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`);
const pct2 = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(2)}%`);
const colour = partyColour;
const STATE = "Tamil Nadu";
const GROUP_KEY = TN_GROUP_KEY;
const PROFILE_ORDER: Record<string, string[]> = {
  op: ["age", "caste", "prof", "zone", "dist", "ac", "v21", "app"],
  ex: ["zone", "dist", "ac", "v21", "age", "caste", "prof", "form", "religion", "app"],
};

type SearchState = { view: "op" | "ex" | "social"; slot: string; profile: string };

function searchFrom(state: SearchState, filter?: SocialFilter | null) {
  const params = new URLSearchParams();
  params.set("view", state.view);
  if (state.view !== "social") params.set("slot", state.slot || "all");
  if (state.profile) params.set("profile", state.profile);
  if (filter) {
    params.set("match", filter.match);
    if (filter.kind) params.set("kind", filter.kind);
    if (filter.place) params.set("place", filter.place);
    if (filter.label) params.set("label", filter.label);
    if (filter.value) params.set("value", filter.value);
    if (filter.average) params.set("average", filter.average);
    if (filter.group) params.set("group", filter.group);
  }
  return params.toString();
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

function CountUp({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(value);
  const previous = useRef(value);
  useEffect(() => {
    if (reduced) { setShown(value); previous.current = value; return; }
    const from = previous.current;
    if (from === value) { setShown(value); return; }
    const started = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / 260);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (value - from) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
      else previous.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [reduced, value]);
  return <>{shown.toFixed(decimals)}{suffix}</>;
}

function Section({ title, note, children, className }: { title: string; note?: string; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setSeen(true); observer.disconnect(); } }, { threshold: 0.08 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <section ref={ref} className={cn("tn-reveal scroll-mt-28 rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.035)] sm:p-6", seen && "tn-reveal-in", className)} aria-label={title}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[23px] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--theme-text)]">{title}</h3>
        {note && <p className="text-[13px] text-[color:var(--theme-text-3)]">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function LazyMount({ children, minHeight = 420 }: { children: React.ReactNode; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setShown(true); observer.disconnect(); } }, { rootMargin: "320px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} style={{ minHeight: shown ? undefined : minHeight }}>{shown ? children : null}</div>;
}

function VoteShareHero({ expected, parties, slotKey }: { expected: SurveyShare; parties: string[]; slotKey: string }) {
  const reduced = usePrefersReducedMotion();
  const [grown, setGrown] = useState(reduced);
  useEffect(() => {
    if (reduced) { setGrown(true); return; }
    setGrown(false);
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
    return () => cancelAnimationFrame(frame);
  }, [reduced, slotKey]);
  const ranked = [...parties].sort((a, b) => (expected[b] ?? 0) - (expected[a] ?? 0));
  const lead = ranked[0];
  const runner = ranked[1];
  const margin = (expected[lead] ?? 0) - (expected[runner] ?? 0);
  return (
    <div className="rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.035)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PartyBadge party={lead} size={28} />
          <div>
            <p className="font-display text-[22px] font-semibold leading-none tracking-[-0.02em] text-[color:var(--theme-text)]">{lead} leads by {margin.toFixed(1)} pts</p>
          </div>
        </div>
        <p className="text-[13px] font-semibold text-[color:var(--theme-text-3)]">2026 vote share</p>
      </div>
      <div className="mt-4 flex h-10 w-full overflow-hidden rounded-full bg-[color:var(--theme-surface-2)] ring-1 ring-inset ring-black/5" role="img" aria-label="Vote share distribution">
        {parties.map((party) => {
          const value = Math.max(0, expected[party] ?? 0);
          return (
            <span key={party} title={`${party} ${pct(expected[party])}`} className="flex min-w-0 items-center justify-center overflow-hidden whitespace-nowrap text-[12px] font-bold transition-[width] duration-300 ease-out" style={{ width: grown ? `${value}%` : "0%", background: colour(party), color: partyNeedsWhiteInk(party) ? "#fff" : "#0B0B0C", textShadow: partyNeedsWhiteInk(party) ? "0 1px 2px rgba(0,0,0,.45)" : "none" }}>
              {value >= 14 ? <span className="hidden items-center gap-1.5 lg:inline-flex"><PartyBadge party={party} size={16} />{party} {value.toFixed(1)}%</span> : ""}
            </span>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[color:var(--theme-text-3)] lg:hidden">
        {parties.map((party) => (
          <span key={party} className="inline-flex items-center gap-1.5">
            <PartyBadge party={party} size={16} />{party} {pct(expected[party])}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function TnSurveyDashboard({
  model,
  owner,
  initialView,
  initialSlot,
  initialProfile,
  initialSocialFilter,
}: {
  model: TnClientModel;
  owner: boolean;
  initialView: "op" | "ex" | "social";
  initialSlot?: string | null;
  initialProfile?: string | null;
  initialSocialFilter?: SocialFilter | null;
}) {
  const { theme } = useTheme();
  const [view, setView] = useState<"op" | "ex" | "social">(initialView);
  const [socialMounted, setSocialMounted] = useState(initialView === "social");
  const [slotKey, setSlotKey] = useState(initialSlot ?? "all");
  const [profileKey, setProfileKey] = useState(initialProfile ?? "");
  const [socialFilter, setSocialFilter] = useState<SocialFilter | null>(initialSocialFilter ?? null);
  const [district, setDistrict] = useState<string | null>(null);
  const [acNo, setAcNo] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [lazyLoading, setLazyLoading] = useState(false);
  const [slowLoad, setSlowLoad] = useState(false);
  const [lazyProfiles, setLazyProfiles] = useState<Record<string, SurveyDemo>>({});
  const socialOverviewRef = useRef<TnSocialOverview | null>(null);
  const socialPrefetched = useRef(false);
  const socialChunkLoaded = useRef(false);
  const mapHostRef = useRef<HTMLElement>(null);
  const mapCache = useRef(new Map<string, TnSerializedMap>([[`${initialView === "ex" ? "ex" : "op"}:${initialSlot ?? "all"}`, model.initialMap]]));
  const mapInflight = useRef(new Map<string, Promise<TnSerializedMap | null>>());
  const profileCache = useRef(new Map<string, SurveyDemo>());
  const prefetched = useRef(new Set<string>());
  const fetchedProfile = useRef(new Set<string>());
  const pendingRestore = useRef<number | null>(null);

  const periodKey = view === "social" ? "op" : view;
  const slots = model.slots[periodKey] ?? [];
  const slot: TnSlotModel = slots.find((item) => item.key === slotKey) ?? slots[0];
  const mapKey = `${periodKey}:${slot.key}`;
  const map = mapCache.current.get(mapKey) ?? model.initialMap;
  const parties = model.parties;
  const expected = slot.expected[STATE] ?? {};
  const actual = model.actual[STATE] ?? {};
  const seats = slot.seats ?? {};
  const leadParty = leaderOf(expected, parties);
  const profiles = useMemo(() => {
    const catalog = slot.demoCatalog ?? {};
    const order = PROFILE_ORDER[periodKey] ?? [];
    const keys = order.filter((key) => catalog[key]);
    for (const key of Object.keys(catalog)) if (!keys.includes(key)) keys.push(key);
    return keys;
  }, [periodKey, slot.demoCatalog]);
  const activeProfile = profiles.includes(profileKey) ? profileKey : profiles[0] ?? "";
  useEffect(() => {
    const node = document.querySelector<HTMLElement>(`[data-profile-tab="${activeProfile}"]`);
    const strip = node?.parentElement;
    if (!node || !strip) return;
    strip.scrollTo({ left: node.offsetLeft - strip.clientWidth / 2 + node.offsetWidth / 2, behavior: "auto" });
  }, [activeProfile]);
  const demo = slot.profiles[activeProfile] ?? lazyProfiles[`${mapKey}:${activeProfile}`] ?? (activeProfile === "ac" ? undefined : null);
  const average = demo ? weightedAiadminAverage(demo.rows, parties) : 0;

  const setState = useCallback((next: SearchState, filter?: SocialFilter | null, replace = false) => {
    const query = searchFrom(next, filter);
    const url = `${window.location.pathname}?${query}`;
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    setView(next.view);
    setSlotKey(next.slot);
    setProfileKey(next.profile);
    setSocialFilter(filter ?? null);
  }, []);

  const navigate = useCallback((next: Partial<SearchState> & { filter?: SocialFilter | null }, replace = false) => {
    const state: SearchState = {
      view: next.view ?? view,
      slot: next.slot ?? slotKey,
      profile: next.profile ?? profileKey,
    };
    const filter = next.filter === undefined ? socialFilter : next.filter;
    try { sessionStorage.setItem("ro:tn-survey-scroll", JSON.stringify({ ...state, y: window.scrollY })); } catch { /* storage can be blocked */ }
    setState(state, filter, replace);
  }, [profileKey, setState, slotKey, socialFilter, view]);

  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const nextView = params.get("view") === "social" ? "social" : params.get("view") === "ex" ? "ex" : "op";
      setView(nextView);
      setSlotKey(params.get("slot") ?? "all");
      setProfileKey(params.get("profile") ?? "");
      setSocialFilter(params.get("match") ? {
        match: params.get("match") as SocialFilter["match"],
        kind: params.get("kind") ?? undefined,
        place: params.get("place") ?? undefined,
        label: params.get("label") ?? undefined,
        value: params.get("value") ?? undefined,
        average: params.get("average") ?? undefined,
        group: params.get("group") ?? undefined,
      } : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const fetchMap = useCallback(async (period: "op" | "ex", key: string) => {
    const cacheKey = `${period}:${key}`;
    const cached = mapCache.current.get(cacheKey);
    if (cached) return cached;
    const existing = mapInflight.current.get(cacheKey);
    if (existing) return existing;
    const request = fetch(`/api/survey/tn/map?state=tamil-nadu&period=${period}&slot=${encodeURIComponent(key)}`, { headers: { "Cache-Control": "max-age=300" } })
      .then((response) => response.json())
      .then((payload) => {
        if (!payload.ok) return null;
        const next = payload.map as TnSerializedMap;
        mapCache.current.set(cacheKey, next);
        return next;
      })
      .catch(() => null)
      .finally(() => { mapInflight.current.delete(cacheKey); });
    mapInflight.current.set(cacheKey, request);
    return request;
  }, []);

  useEffect(() => {
    if (view === "social") setSocialMounted(true);
  }, [view]);

  useEffect(() => {
    const node = document.querySelector<HTMLElement>("[data-slot-active='true']");
    const strip = node?.parentElement;
    if (!node || !strip) return;
    strip.scrollTo({ left: node.offsetLeft - strip.clientWidth / 2 + node.offsetWidth / 2, behavior: "auto" });
  }, [slotKey, view]);

  useEffect(() => {
    const node = mapHostRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") { setMapMounted(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setMapMounted(true); observer.disconnect(); }
    }, { rootMargin: "320px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (view === "social") return;
    const cacheKey = `${view}:${slotKey}`;
    const cached = mapCache.current.get(cacheKey);
    if (cached) { setMapLoading(false); return; }
    let cancelled = false;
    setMapLoading(true);
    void fetchMap(view, slotKey).then((next) => {
      if (!cancelled && next) { mapCache.current.set(cacheKey, next); setMapLoading(false); }
      else if (!cancelled) setMapLoading(false);
    });
    return () => { cancelled = true; };
  }, [fetchMap, slotKey, view]);

  const prefetchProfile = useCallback((key: string) => {
    if (key !== "ac") return;
    const cacheKey = `${mapKey}:ac`;
    if (profileCache.current.has(cacheKey)) return;
    fetchedProfile.current.add(cacheKey);
    void fetch(`/api/survey/tn/profile?state=tamil-nadu&period=${periodKey}&slot=${encodeURIComponent(slot.key)}&profile=ac`, { headers: { "Cache-Control": "max-age=300" } })
      .then((response) => response.json())
      .then((payload) => {
        if (payload.ok) { profileCache.current.set(cacheKey, payload.demo as SurveyDemo); setLazyProfiles((current) => ({ ...current, [cacheKey]: payload.demo as SurveyDemo })); }
      })
      .catch(() => {});
  }, [mapKey, periodKey, slot.key]);

  const prefetch = useCallback((period: "op" | "ex", key: string) => {
    const cacheKey = `${period}:${key}`;
    if (prefetched.current.has(cacheKey) || mapCache.current.has(cacheKey)) return;
    prefetched.current.add(cacheKey);
    void fetchMap(period, key);
  }, [fetchMap]);

  useEffect(() => {
    if (view === "social" || !profiles.includes("ac")) return;
    const cacheKey = `${mapKey}:ac`;
    if (profileCache.current.has(cacheKey)) { setLazyProfiles((current) => ({ ...current, [cacheKey]: profileCache.current.get(cacheKey)! })); return; }
    if (activeProfile !== "ac" || lazyProfiles[cacheKey]) return;
    let cancelled = false;
    setLazyLoading(true);
    void fetch(`/api/survey/tn/profile?state=tamil-nadu&period=${periodKey}&slot=${encodeURIComponent(slot.key)}&profile=ac`, { headers: { "Cache-Control": "max-age=300" } })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled || !payload.ok) return;
        profileCache.current.set(cacheKey, payload.demo as SurveyDemo);
        setLazyProfiles((current) => ({ ...current, [cacheKey]: payload.demo as SurveyDemo }));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLazyLoading(false); });
    return () => { cancelled = true; };
  }, [activeProfile, lazyProfiles, mapKey, periodKey, profiles, slot.key, view]);

  useEffect(() => {
    if (!mapLoading && !lazyLoading) { setSlowLoad(false); return; }
    const timer = window.setTimeout(() => setSlowLoad(true), 200);
    return () => window.clearTimeout(timer);
  }, [lazyLoading, mapLoading]);

  useEffect(() => {
    if (!mapMounted) return;
    const id = window.setTimeout(() => {
      for (const item of slots) prefetch(periodKey, item.key);
    }, 700);
    return () => window.clearTimeout(id);
  }, [mapMounted, periodKey, prefetch, slots]);

  const prefetchSocial = useCallback(() => {
    if (!socialChunkLoaded.current) {
      socialChunkLoaded.current = true;
      void import("./tn-social-media").catch(() => { socialChunkLoaded.current = false; });
    }
    if (socialPrefetched.current) return;
    socialPrefetched.current = true;
    void fetch("/api/survey/social?state=tamil-nadu")
      .then((response) => response.json())
      .then((payload) => { if (payload.ok) socialOverviewRef.current = payload.overview as TnSocialOverview; })
      .catch(() => { socialPrefetched.current = false; });
  }, []);

  useEffect(() => {
    const onScroll = () => prefetchSocial();
    window.addEventListener("scroll", onScroll, { once: true, passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [prefetchSocial]);

  const openSocial = useCallback((filter?: SocialFilter) => {
    navigate({ view: "social", filter: filter ?? null });
  }, [navigate]);

  const closeSocial = useCallback(() => {
    let saved: SearchState | null = null;
    let y = 0;
    try {
      const raw = JSON.parse(sessionStorage.getItem("ro:tn-survey-scroll") ?? "null") as (SearchState & { y?: number }) | null;
      saved = raw; y = raw?.y ?? 0;
    } catch { saved = null; }
    pendingRestore.current = y;
    if (saved && saved.view !== "social") navigate(saved, true);
    else if (window.history.length > 1) window.history.back();
    else navigate({ view: "op", slot: "all", profile: "" }, true);
  }, [navigate]);

  useEffect(() => {
    if (view === "social" || pendingRestore.current == null) return;
    const y = pendingRestore.current;
    pendingRestore.current = null;
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "auto" })));
  }, [profileKey, slotKey, socialFilter, view]);

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

  return (
    <main className="relative min-h-0 bg-[color:var(--theme-surface)] text-[16px] text-[var(--p-ink)]">
      <div className={cn("fixed left-0 top-0 z-50 h-0.5 bg-[color:var(--theme-text)] transition-all duration-200", slowLoad ? "w-full opacity-100" : "w-0 opacity-0")} aria-hidden />
      <div className="mx-auto w-full max-w-[1680px] px-4 pb-20 pt-20 sm:px-6 sm:pt-20 xl:px-8">
        <header className="flex flex-wrap items-center gap-3">
          <Link href="/case-studies" className="inline-flex min-h-11! shrink-0 items-center gap-2 rounded-full border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] px-3.5 py-1.5 text-[14px] text-[color:var(--theme-text-3)] transition-colors hover:border-[color:var(--theme-text)] hover:text-[color:var(--theme-text)]">
            <ArrowLeft className="size-4" /><span className="hidden sm:inline">Back to Case Studies</span><span className="sm:hidden">Back</span>
          </Link>
          <div className="inline-flex min-h-11! shrink-0 items-center gap-2 rounded-full border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] py-1 pl-1 pr-3">
            <span className="grid size-8 place-items-center rounded-full bg-[color:var(--theme-surface-2)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/parties/aiadmk.png" alt="AIADMK symbol" width={28} height={19} className="h-auto w-7 object-contain" />
            </span>
            <span className="leading-tight">
              <span className="block text-[13px] font-bold text-[color:var(--theme-text)]">AIADMK</span>
              <span className="block text-[12px] text-[color:var(--theme-text-3)]">Tamil Nadu</span>
            </span>
          </div>
          {owner && (
            <button type="button" onClick={() => void download()} disabled={downloading} className="inline-flex min-h-11! items-center gap-1.5 rounded-full border border-[color:var(--theme-text)] px-4 text-[13px] font-semibold text-[color:var(--theme-text)] hover:bg-[color:var(--theme-text)] hover:text-white disabled:opacity-50 sm:ml-auto">
              <ArrowDownToLine className="size-4" /> {downloading ? "Preparing..." : "Download data"}
            </button>
          )}
          <p className={cn("w-full text-[15px] font-medium text-[color:var(--theme-text-2)] sm:w-auto sm:text-right", owner ? "sm:ml-0" : "sm:ml-auto")}>{int(model.n_total)} responses</p>
        </header>

        <div className="mt-4 grid grid-cols-1 gap-3 min-[900px]:grid-cols-3">
          {model.cards.map((card) => (
            <button key={card.key} type="button" aria-pressed={view === card.key} onMouseEnter={() => prefetch(card.key, "all")} onClick={() => { setDistrict(null); setAcNo(null); navigate({ view: card.key, slot: "all", profile: "", filter: null }); }}
              className={cn("tn-card flex min-h-[112px] flex-col justify-center rounded-2xl border-2 p-4 text-left transition-all min-[1360px]:min-h-[120px]", view === card.key ? "border-[color:var(--theme-selected)] bg-[color:var(--theme-selected)] text-white shadow-[0_0_0_2px_var(--theme-surface),0_0_0_4px_var(--theme-selected)]" : "border-[color:var(--theme-border)] bg-[color:var(--theme-surface-2)] text-[color:var(--theme-text)] hover:-translate-y-0.5 hover:border-[color:var(--theme-border)]")}>
              <p className="text-[17px] font-bold">{card.label}</p>
              <p className={cn("mt-1.5 text-[14px] font-semibold", view === card.key ? "text-white/90" : "text-[color:var(--theme-text-2)]")}>{parties.slice(0, 3).map((party) => `${party} ${pct(card.expected[party])}`).join(" · ")}</p>
              <p className={cn("mt-1.5 text-[14px] font-bold", view === card.key ? "text-[#4ade80]" : "text-[color:var(--theme-positive)]")}>accuracy {card.accuracy.toFixed(1)}%</p>
            </button>
          ))}
          <button type="button" aria-pressed={view === "social"} onMouseEnter={() => prefetchSocial()} onPointerDown={() => prefetchSocial()} onFocus={() => prefetchSocial()} onClick={() => openSocial()} className={cn("tn-card group flex min-h-[112px] items-center rounded-2xl border-2 p-4 text-left transition-all min-[1360px]:min-h-[120px]", view === "social" ? "border-[#1877F2] bg-[color:var(--theme-selected)] text-white shadow-[0_0_0_2px_var(--theme-surface),0_0_0_4px_var(--theme-selected)]" : "border-[color:var(--theme-border)] bg-[color:var(--theme-surface-2)] text-[color:var(--theme-text)] hover:-translate-y-0.5 hover:border-[color:var(--theme-border)]")}>
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[17px] font-bold"><Megaphone className="size-5" /> Social Media</p>
                <p className={cn("mt-1.5 whitespace-nowrap text-[13px] font-semibold", view === "social" ? "text-white/80" : "text-[color:var(--theme-text-2)]")}>Ads · reach & engagement</p>
              </div>
              <span className="flex shrink-0 items-center gap-2.5">
                <SocialCluster iconSize={22} tileSize={30} columns={2} className="grid min-[1360px]:hidden" />
                <SocialCluster iconSize={30} tileSize={42} columns={2} className="hidden min-[1360px]:grid" />
                <TrendChart data={model.socialMonthly} series={[{ metric: "reach", label: "Reach", color: "var(--theme-chart-reach)" }]} height={44} label="Monthly reach" className="hidden h-11 w-[140px] min-[1360px]:block" />
              </span>
            </div>
          </button>
        </div>

        {view !== "social" && (
          <div className="mt-4 flex items-center gap-2">
            <span className="shrink-0 text-[12px] font-bold uppercase tracking-[0.12em] text-[color:var(--theme-warning)]">{view === "ex" ? "Day" : "Month"}</span>
            <div className="scroll-fade-x no-scrollbar flex flex-1 flex-nowrap items-center gap-2 overflow-x-auto pb-1 snap-x" role="group" aria-label="Survey time slot">
            {slots.filter((item) => !item.subKey).map((item) => {
              const itemLead = leaderOf(item.expected[STATE] ?? {}, parties) ?? "TVK";
              const subs = slots.filter((candidate) => candidate.subKey && candidate.monthKey === item.key);
              return (
                <div key={item.key} className="relative shrink-0 snap-start">
                  <button type="button" data-slot-active={slot.key === item.key || slot.monthKey === item.key ? "true" : undefined} aria-pressed={slot.key === item.key || slot.monthKey === item.key} onMouseEnter={() => prefetch(periodKey, item.key)} onClick={(event) => {
                      navigate({ slot: item.key, profile: "" });
                      const strip = event.currentTarget.closest(".no-scrollbar") as HTMLElement | null;
                      if (strip) {
                        const sr = strip.getBoundingClientRect(), br = event.currentTarget.getBoundingClientRect();
                        strip.scrollTo({ left: strip.scrollLeft + br.left - sr.left - (strip.clientWidth - br.width) / 2, behavior: "smooth" });
                      }
                    }}
                    className={cn("min-h-11! rounded-full border px-4 text-[14px] font-semibold transition-all active:scale-[0.98]", slot.key === item.key || slot.monthKey === item.key ? "border-[color:var(--theme-selected)] shadow-[0_0_0_2px_var(--theme-surface),0_0_0_3.5px_var(--theme-selected)]" : "border-[color:var(--theme-border)] hover:border-[color:var(--theme-text)]")}
                    style={{ background: slot.key === item.key || slot.monthKey === item.key ? colour(itemLead) : `color-mix(in srgb, ${colour(itemLead)} 16%, var(--theme-surface))`, color: slot.key === item.key || slot.monthKey === item.key ? (partyNeedsWhiteInk(itemLead) ? "#fff" : "#0B0B0C") : "var(--theme-text)" }}>
                    {item.buttonLabel}{subs.length ? <ChevronDown className="ml-1 inline size-4" /> : null}
                  </button>
                </div>
              );
            })}
            {slots.filter((candidate) => candidate.subKey && candidate.monthKey === (slot.monthKey ?? "")).map((item) => (
              <button key={item.key} type="button" aria-pressed={slot.key === item.key} onClick={() => navigate({ slot: item.key, profile: "" })} className={cn("min-h-11! shrink-0 snap-start rounded-full border px-3 text-[13px] font-semibold active:scale-[0.98]", slot.key === item.key ? "border-[color:var(--theme-selected)] bg-[color:var(--theme-selected)] text-white" : "border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] text-[color:var(--theme-text-2)] hover:border-[color:var(--theme-text)]")}>{item.buttonLabel}</button>
            ))}
          </div>
          </div>
        )}

        {socialMounted && (
          <div className={cn("mt-4", view === "social" ? "tn-crossfade" : "hidden")}><TnSocialMedia stateSlug="tamil-nadu" initialFilter={socialFilter} initialOverview={socialOverviewRef.current} onClose={closeSocial} owner={owner} /></div>
        )}
        <div className={view === "social" ? "hidden" : undefined}>
          <>
            <div className="no-scrollbar mt-4 grid grid-cols-2 gap-3 min-[640px]:flex min-[640px]:snap-x min-[640px]:overflow-x-auto min-[640px]:pb-1 min-[1100px]:grid min-[1100px]:grid-cols-5">
              {parties.map((party, partyIndex) => {
                const value = expected[party] ?? 0;
                const perParty = Math.max(0, 100 - Math.abs(value - (actual[party] ?? 0)));
                return (
                  <div key={party} className={cn("min-w-0 rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.03)] min-[640px]:min-w-[160px] min-[640px]:flex-1 min-[640px]:snap-start min-[1100px]:min-w-0", partyIndex === 4 && "col-span-2 min-[640px]:col-span-1")} style={{ borderTopColor: colour(party), borderTopWidth: 3 }}>
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--theme-text-2)]"><PartyBadge party={party} size={24} />{party} · {view === "ex" ? "share" : "expected"}</p>
                    <p className="tn-number mt-1 text-[38px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[color:var(--theme-text)]"><CountUp value={value} decimals={2} suffix="%" /></p>
                    <p className="mt-1.5 text-[12.5px] font-semibold text-[color:var(--theme-negative)]">Actual 2026: {pct2(actual[party])}</p>
                    <p className="mt-0.5 text-[12.5px] font-semibold text-[color:var(--theme-positive)]">Accuracy {perParty.toFixed(1)}%</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-3"><VoteShareHero expected={expected} parties={parties} slotKey={slot.key} /></div>

            <section ref={mapHostRef} className="relative mt-3 scroll-mt-28 rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.035)] sm:p-4" aria-label="Tamil Nadu map">
              <div className="mb-2 flex h-11 items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-[color:var(--theme-text-3)]">{district ?? (acNo != null ? `Assembly constituency ${acNo}` : "Tamil Nadu districts")}</p>
                {(district || acNo != null) && (
                  <button type="button" onClick={() => { setDistrict(null); setAcNo(null); }} className="inline-flex min-h-11! items-center gap-1.5 rounded-full border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] px-3.5 text-[13px] font-semibold text-[color:var(--theme-text)] transition-colors hover:border-[color:var(--theme-text)] hover:bg-[color:var(--theme-surface-3)]">
                    <ArrowLeft className="size-4" /> Back to state
                  </button>
                )}
              </div>
              <div className={cn("relative h-[380px] overflow-hidden rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-2)] transition-opacity md:h-[680px] xl:h-[700px]", mapLoading && "opacity-60")}>
                {mapMounted ? <TamilNaduMap
                  acs={map.acs}
                  districts={map.districts}
                  district={district}
                  acNo={acNo}
                  year="2026"
                  theme={theme}
                  fitKey={0}
                  onSelectDistrict={(name) => { setDistrict(name); setAcNo(null); }}
                  onSelectAc={(no) => setAcNo(no)}
                  onReset={() => { setDistrict(null); setAcNo(null); }}
                  tooltip={(payload) => {
                    const row = payload.kind === "district" ? map.districtRows[canonicalDistrictName(payload.name)] : payload.no != null ? map.acRows[String(payload.no)] : undefined;
                    const shares = row?.shares as Record<string, number> | null | undefined;
                    const ranked = parties
                      .map((party) => ({ party, value: Number(shares?.[GROUP_KEY[party] ?? party] ?? 0) * 100 }))
                      .sort((a, b) => b.value - a.value);
                    return {
                      title: payload.name,
                      leader: shares && ranked[0] && ranked[0].value > 0 ? ranked[0].party : null,
                      rows: shares ? ranked : [],
                    };
                  }}
                /> : <div className="grid h-full place-items-center text-[14px] text-[color:var(--theme-text-3)]">Preparing map...</div>}
                {mapLoading && <p role="status" className="absolute inset-0 grid place-items-center text-[14px] font-semibold text-[color:var(--theme-text-3)]">Loading map...</p>}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-[color:var(--theme-text-2)]">
                {parties.map((party) => <span key={party} className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded-[2px] ring-1 ring-inset ring-black/10" style={{ background: colour(party) }} />{party}</span>)}
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded-[2px] bg-[#94A3B8] ring-1 ring-inset ring-black/10" />No data / under 30</span>
              </div>
            </section>

            {profiles.length > 0 && (
              <Section title={`Voter profile · ${slot.buttonLabel}`} className="mt-3">
                <div className="scroll-fade-x no-scrollbar mt-3 flex flex-nowrap gap-2 overflow-x-auto pb-1 snap-x" role="tablist" aria-label="Voter profile">
                  {profiles.map((key) => (
                    <button key={key} type="button" role="tab" data-profile-tab={key} aria-selected={activeProfile === key} onMouseEnter={() => prefetchProfile(key)} onClick={(event) => {
                      navigate({ profile: key });
                      const strip = event.currentTarget.closest(".no-scrollbar") as HTMLElement | null;
                      if (strip) {
                        const sr = strip.getBoundingClientRect(), br = event.currentTarget.getBoundingClientRect();
                        strip.scrollTo({ left: strip.scrollLeft + br.left - sr.left - (strip.clientWidth - br.width) / 2, behavior: "smooth" });
                      }
                    }} className={cn("min-h-11! shrink-0 snap-start rounded-full border px-3.5 text-[13px] font-semibold active:scale-[0.98]", activeProfile === key ? "border-[color:var(--theme-warning)] bg-[color:var(--theme-warning-soft)] text-[color:var(--theme-text)]" : "border-[color:var(--theme-border)] text-[color:var(--theme-text-2)] hover:border-[color:var(--theme-text)]")}>
                      {slot.demoCatalog[key]?.label ?? key}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <LazyMount minHeight={540}>
                    {!demo && activeProfile === "ac" ? <div className="rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-3)] p-6 text-[14px] text-[color:var(--theme-text-3)]">Loading assembly table...</div> :
                      demo ? <div key={`${slot.key}:${activeProfile}`} className="tn-fade-slide"><TnProfileTable demo={demo} parties={parties} profileKey={activeProfile} periodKey={view} slotLabel={slot.label} average={average}
                        onTarget={(payload) => openSocial({ match: "target", kind: payload.kind, place: payload.place, label: `${payload.label} · ${payload.place} · AIADMK+ ${payload.value.toFixed(1)}% (average ${payload.average.toFixed(1)}%)`, value: String(payload.value), average: String(payload.average) })}
                        onCampaigns={(payload) => openSocial({ match: "campaigns", kind: payload.kind, place: payload.place, label: payload.place })}
                        onGroup={(group) => openSocial({ match: "group", group, label: group })}
                      /></div> : null}
                  </LazyMount>
                </div>
              </Section>
            )}
            <LazyMount minHeight={380}><SwingSection data={model} swing={model.swing} parties={parties} period={view === "ex" ? "ex" : "op"} slot={slot.key} /></LazyMount>
            <LazyMount minHeight={520}><SeatsByZone data={model} parties={parties} seats={seats} periodKey={view} slotLabel={slot.label} /></LazyMount>
          </>
        </div>
      </div>
    </main>
  );
}

function SwingSection({ data, swing, parties, period, slot }: { data: TnClientModel; swing: TnSwingPayload; parties: string[]; period: "op" | "ex"; slot: string }) {
  const state = "Tamil Nadu";
  const sources = swing.sources[period] ?? [];
  const source = sources.find((item) => item.key === slot) ?? sources[0];
  if (!source) return <Section title={`Zone swing · ${period === "ex" ? "Exit poll" : "Opinion poll"}`} className="mt-3"><p className="mt-2 text-[14px] text-[color:var(--theme-text-3)]">No swing data in this upload.</p></Section>;
  return (
    <Section title={`Zone swing · ${source.label}`} className="mt-3">
      <div className="mt-3 overflow-x-auto rounded-xl border border-[color:var(--theme-border)]">
        <table className="w-full min-w-[980px] border-collapse text-[15px]">
          <thead className="bg-[color:var(--theme-surface-3)] text-left text-[13px] uppercase tracking-wide text-[color:var(--theme-text-3)]"><tr><th className="px-4 py-3">Zone</th>{parties.map((party) => <th key={party} className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1.5"><PartyBadge party={party} size={16} />{party} 21→26</span></th>)}</tr></thead>
          <tbody>
            {data.regions.map((region) => {
              const before = data.base?.[region] ?? TN_2021_BASE[region];
              const after = source.expected[region];
              if (!before || !after) return null;
              return (
                <tr key={region} className={cn("border-t border-[color:var(--theme-border)]", region === state && "font-bold")}>
                  <th scope="row" className="px-4 py-2.5 text-left">{data.zonelabels?.[region] ?? region}</th>
                  {parties.map((party) => {
                    const swing = (after[party] ?? 0) - (before[party] ?? 0);
                    const tone = swingTone(swing);
                    return <td key={party} className="px-4 py-2.5 text-center tabular-nums">{pct(before[party])} → {pct(after[party])} <span className={cn("ml-1 rounded px-1.5 py-0.5 text-[12px] font-bold", tone === "up" ? "bg-[color:var(--theme-positive-soft)] text-[color:var(--theme-positive)]" : tone === "down" ? "bg-[color:var(--theme-negative-soft)] text-[color:var(--theme-negative)]" : "text-[color:var(--theme-text-3)]")}>{swingLabel(swing)}</span>{region === state && data.actual[region]?.[party] != null && <span className="mt-0.5 block text-[12px] font-bold text-[color:var(--theme-negative)]">Actual 2026: {pct(data.actual[region][party])}</span>}</td>;
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

function SeatsByZone({ data, parties, seats, periodKey, slotLabel }: { data: TnClientModel; parties: string[]; seats: Record<string, unknown>; periodKey: string; slotLabel: string }) {
  const zones = (seats.zones as Record<string, Record<string, unknown>> | undefined) ?? {};
  const actualZones = (data.actualZones as Record<string, Record<string, unknown>> | undefined) ?? {};
  const actualSeats = data.actualSeats as Record<string, unknown>;
  const summaryParties = ["TVK", "DMK+", "AIADMK+", "NTK"];
  const actualParties = ["TVK", "DMK+", "AIADMK+"];
  const majority = projectedMajority(seats, summaryParties);
  return (
    <Section title={`Seats by zone · ${slotLabel}`} className="mt-3">
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summaryParties.map((party) => (
          <div key={party} className="rounded-xl border border-[color:var(--theme-border)] p-4">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--theme-text-2)]"><PartyBadge party={party} size={24} />{party}</p>
            <p className="mt-1 font-display text-[32px] font-semibold leading-none tabular-nums text-[color:var(--theme-text)]"><CountUp value={Number(seats[party] ?? 0)} /></p>
            <p className="mt-1.5 text-[12.5px] text-[color:var(--theme-text-3)]">projected · actual {int(Number(actualSeats[party] ?? 0))}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-[color:var(--theme-border)]">
        <table className="w-full min-w-[780px] border-collapse text-[15px]" aria-label={majority.status === "majority" ? `${majority.leader} projected majority with ${majority.seats} seats` : "Projected assembly is hung"} >
          <thead className="bg-[color:var(--theme-surface-3)] text-left text-[13px] uppercase tracking-wide text-[color:var(--theme-text-3)]">
            <tr><th rowSpan={2} className="px-4 py-3">Zone</th><th rowSpan={2} className="px-4 py-3 text-right">ACs</th><th colSpan={4} className="px-4 py-3 text-center">Projected</th><th colSpan={3} className="px-4 py-3 text-center">Actual 2026</th></tr>
            <tr>{summaryParties.map((party) => <th key={party} className="px-4 py-2 text-right"><span className="inline-flex items-center gap-1.5"><PartyBadge party={party} size={16} />{party}</span></th>)}{actualParties.map((party) => <th key={party} className="px-4 py-2 text-right"><span className="inline-flex items-center gap-1.5"><PartyBadge party={party} size={16} />{party}</span></th>)}</tr>
          </thead>
          <tbody>
            {Object.entries(zones).map(([zone, row]) => (
              <tr key={zone} className="border-t border-[color:var(--theme-border)]">
                <th scope="row" className="px-4 py-2.5 text-left font-semibold">{data.zonelabels?.[zone] ?? zone}</th>
                <td className="px-4 py-2.5 text-right tabular-nums">{int(Number(row.acs ?? 0))}</td>
                {summaryParties.map((party) => <td key={party} className="px-4 py-2.5 text-right tabular-nums">{int(Number(row[party] ?? 0))}</td>)}
                {actualParties.map((party) => <td key={party} className="px-4 py-2.5 text-right tabular-nums">{int(Number(actualZones[zone]?.[party] ?? 0))}</td>)}
              </tr>
            ))}
            <tr className="border-t-2 border-[color:var(--theme-text)] font-bold">
              <th scope="row" className="px-4 py-3 text-left">Tamil Nadu</th>
              <td className="px-4 py-3 text-right tabular-nums">234</td>
              {summaryParties.map((party) => <td key={party} className="px-4 py-3 text-right tabular-nums">{int(Number(seats[party] ?? 0))}</td>)}
              {actualParties.map((party) => <td key={party} className="px-4 py-3 text-right tabular-nums">{int(Number(actualSeats[party] ?? 0))}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </Section>
  );
}
