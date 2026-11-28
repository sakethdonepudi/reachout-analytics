"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowDownToLine, ArrowLeft, ChevronDown, Megaphone } from "lucide-react";
const TnSocialMedia = dynamic(() => import("./tn-social-media"), {
  ssr: false,
  loading: () => <div className="rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-8 text-[14px] text-[color:var(--theme-text-3)]">Preparing the social view...</div>,
});
import type { SocialFilter, TnSocialOverview } from "@/lib/survey/social-types";
import TnProfileTable, { weightedPartyAverage } from "./tn-profile-table";
import { PartyBadge } from "./party-badge";
import type { SurveyDemo, SurveyShare } from "@/lib/survey/types";
import type { TnClientModel, TnSerializedMap, TnSlotModel, TnSwingPayload } from "@/lib/survey/tn-view-model";
import { TN_2021_BASE } from "@/lib/tamil-nadu/baseline";
import { canonicalDistrictName } from "@/lib/tamil-nadu/aliases";
import { partyColour, partyNeedsWhiteInk, TN_GROUP_KEY } from "@/lib/tamil-nadu/party-brand";
import { projectedMajority } from "@/lib/tamil-nadu/majority";
import { swingLabel, swingTone } from "@/lib/tamil-nadu/swing";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import { latestMonthFromSlots } from "@/lib/survey/post-poll";
import { cn } from "@/lib/utils";
import { SocialCluster } from "./social-icons";
import { TrendChart } from "./trend-chart";
import { Pill, PillRow } from "@/components/case-studies/shared/pill-row";
import { useTheme } from "@/components/site/theme";
import { TN_CONFIG, type CaseStudyConfig } from "@/lib/case-study/config";

const TamilNaduMap = dynamic(() => import("./tamil-nadu-map"), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[420px] w-full place-items-center text-[14px] text-[color:var(--theme-text-3)]">Loading map...</div>,
});
const ApMap = dynamic(() => import("../andhra-pradesh/ap-map"), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[420px] w-full place-items-center text-[14px] text-[color:var(--theme-text-3)]">Loading map...</div>,
});

const int = (value: number) => new Intl.NumberFormat("en-IN").format(Math.round(value));
const pct = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`);
const pct2 = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(2)}%`);
const displayParty = (config: CaseStudyConfig, party: string) => config.partyLabels?.[party] ?? party;


type SearchState = { view: string; slot: string; profile: string };

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

function weightedLeader(demo: SurveyDemo | undefined, parties: string[]) {
  if (!demo?.rows.length) return null;
  const total = demo.rows.reduce((sum, row) => sum + row.n, 0);
  if (!total) return null;
  const weighted = parties.map((party, index) => ({ party, value: demo.rows.reduce((sum, row) => sum + (row.v[index] ?? 0) * row.n, 0) / total }));
  weighted.sort((a, b) => b.value - a.value);
  return weighted[0]?.party ?? null;
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
        <h2 className="font-display text-[23px] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--theme-text)]">{title}</h2>
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

export default function TnSurveyDashboard({
  model,
  owner,
  initialView,
  initialSlot,
  initialProfile,
  initialSocialFilter,
  config = TN_CONFIG,
}: {
  model: TnClientModel;
  owner: boolean;
  config?: CaseStudyConfig;
  initialView: string;
  initialSlot?: string | null;
  initialProfile?: string | null;
  initialSocialFilter?: SocialFilter | null;
}) {
  const { theme } = useTheme();
  const colour = (party: string) => config.brand[party]?.color ?? partyColour(party);
  const borderColour = (party: string) => config.brand[party]?.border ?? colour(party);
  const needsWhite = (party: string) => config.partyInk?.[party] ? config.partyInk[party] === "white" : partyNeedsWhiteInk(party);
  const partyLabel = (party: string) => config.partyLabels?.[party] ?? party;
  const [view, setView] = useState<string>(initialView);
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
  const initialMapKey = initialView === "ex" ? "ex" : initialView === "rd" ? "rd" : "op";
  const mapCache = useRef(new Map<string, TnSerializedMap>([[`${initialMapKey}:${initialSlot ?? "all"}`, model.initialMap]]));
  const mapInflight = useRef(new Map<string, Promise<TnSerializedMap | null>>());
  const profileCache = useRef(new Map<string, SurveyDemo>());
  const prefetched = useRef(new Set<string>());
  const fetchedProfile = useRef(new Set<string>());
  const pendingRestore = useRef<number | null>(null);

  const periodKey = view === "social" ? config.defaultView : view;
  const targetMode = config.target ? (view === "rd" && config.target.postPollMode ? config.target.postPollMode : config.target.mode) : "below-average";
  const activeTargetParty = targetMode === "gap" ? config.target?.pillParty ?? config.parties[0] : config.target?.party ?? config.parties[0];
  const slots = model.slots[periodKey] ?? [];
  const postPollDefault = latestMonthFromSlots(model.slots.rd ?? [], config.latestSlot !== "month");
  const slot: TnSlotModel = slots.find((item) => item.key === slotKey) ?? slots[0];
  const mapKey = `${periodKey}:${slot.key}`;
  const map = mapCache.current.get(mapKey) ?? model.initialMap;
  const parties = model.parties;
  const expected = slot.expected[config.stateName] ?? {};
  const actual = model.actual[config.stateName] ?? {};
  const cardParties = config.sortPartyCards ? [...parties].sort((a, b) => (expected[b] ?? 0) - (expected[a] ?? 0)) : parties;
  const seats = slot.seats ?? {};
  const leadParty = leaderOf(expected, parties);
  const profiles = useMemo(() => {
    const catalog = slot.demoCatalog ?? {};
    const order = config.profileOrder[periodKey] ?? [];
    const keys = order.filter((key) => catalog[key]);
    for (const key of Object.keys(catalog)) if (!keys.includes(key)) keys.push(key);
    return keys;
  }, [config.profileOrder, periodKey, slot.demoCatalog]);
  const activeProfile = profiles.includes(profileKey) ? profileKey : profiles[0] ?? "";
  const activeThreshold = config.profileThresholds?.[activeProfile] ?? 30;
  useEffect(() => {
    const node = document.querySelector<HTMLElement>(`[data-profile-tab="${activeProfile}"]`);
    const strip = node?.parentElement;
    if (!node || !strip) return;
    strip.scrollTo({ left: node.offsetLeft - strip.clientWidth / 2 + node.offsetWidth / 2, behavior: "auto" });
  }, [activeProfile]);
  const demo = slot.profiles[activeProfile] ?? lazyProfiles[`${mapKey}:${activeProfile}`] ?? (activeProfile === "ac" ? undefined : null);
  const average = demo ? weightedPartyAverage(demo.rows, parties, activeTargetParty) : 0;

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
      const rawView = params.get("view");
      const nextView = rawView === "social" ? "social" : rawView === "ex" ? "ex" : rawView === "rd" ? "rd" : "op";
      setView(nextView);
      setSlotKey(params.get("slot") ?? (nextView === "rd" ? postPollDefault : "all"));
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
  }, [postPollDefault]);

  const fetchMap = useCallback(async (period: string, key: string) => {
    const cacheKey = `${period}:${key}`;
    const cached = mapCache.current.get(cacheKey);
    if (cached) return cached;
    const existing = mapInflight.current.get(cacheKey);
    if (existing) return existing;
    const request = fetch(`${config.apiBase}/map?state=${config.slug}&period=${period}&slot=${encodeURIComponent(key)}`, { headers: { "Cache-Control": "max-age=300" } })
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
    const frame = requestAnimationFrame(() => {
      const nodes = document.querySelectorAll<HTMLElement>("[data-slot-active='true']");
      const node = nodes[nodes.length - 1];
      const strip = node?.closest<HTMLElement>(".no-scrollbar");
      if (!node || !strip) return;
      const sr = strip.getBoundingClientRect(), br = node.getBoundingClientRect();
      strip.scrollTo({ left: strip.scrollLeft + br.left - sr.left - (strip.clientWidth - br.width) / 2, behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
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
    void fetch(`${config.apiBase}/profile?state=${config.slug}&period=${periodKey}&slot=${encodeURIComponent(slot.key)}&profile=ac`, { headers: { "Cache-Control": "max-age=300" } })
      .then((response) => response.json())
      .then((payload) => {
        if (payload.ok) { profileCache.current.set(cacheKey, payload.demo as SurveyDemo); setLazyProfiles((current) => ({ ...current, [cacheKey]: payload.demo as SurveyDemo })); }
      })
      .catch(() => {});
  }, [mapKey, periodKey, slot.key]);

  const prefetch = useCallback((period: string, key: string) => {
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
    void fetch(`${config.apiBase}/profile?state=${config.slug}&period=${periodKey}&slot=${encodeURIComponent(slot.key)}&profile=ac`, { headers: { "Cache-Control": "max-age=300" } })
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
    void fetch(`/api/survey/social?state=${config.slug}`)
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
    const restore = () => window.scrollTo({ top: y, behavior: "auto" });
    const timer = window.setTimeout(restore, 320);
    const late = window.setTimeout(restore, 640);
    const settle = window.setTimeout(restore, 850);
    const frame = requestAnimationFrame(() => requestAnimationFrame(restore));
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); window.clearTimeout(late); window.clearTimeout(settle); };
  }, [profileKey, slotKey, socialFilter, view]);

  async function download() {
    setDownloading(true);
    try {
      const response = await fetch(`/api/survey/download?state=${config.slug}`);
      if (!response.ok) throw new Error("That data could not be downloaded.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${config.slug}-survey-export.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className={cn("tn-dashboard relative min-h-0 bg-[color:var(--theme-surface)] text-[16px] text-[var(--p-ink)]", config.slug === "karnataka" ? "ka-theme" : config.slug === "telangana" ? "tg-theme" : undefined)}>
      <div className={cn("fixed left-0 top-0 z-50 h-0.5 bg-[color:var(--theme-text)] transition-all duration-200", slowLoad ? "w-full opacity-100" : "w-0 opacity-0")} aria-hidden />
      <div className="mx-auto w-full max-w-[1680px] px-4 pb-20 pt-20 sm:px-6 sm:pt-20 xl:px-8">
        <header className="flex flex-wrap items-center gap-3">
          <Link href="/case-studies" className="tap-44 inline-flex min-h-11 shrink-0 items-center">
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] px-3 text-[12.5px] text-[color:var(--theme-text-3)] transition-colors hover:border-[color:var(--theme-text)] hover:text-[color:var(--theme-text)]">
              <ArrowLeft className="size-3.5" /><span className="hidden sm:inline">Back to Case Studies</span><span className="sm:hidden">Back</span>
            </span>
          </Link>
          {config.neutralHeader ? (
            <div className="inline-flex min-h-11! min-w-0 shrink items-center gap-2 rounded-full border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] py-1.5 pl-1.5 pr-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[color:var(--party-badge-surface)] text-[11px] font-bold uppercase tracking-[0.08em] text-[#0b0b0c] ring-1 ring-black/5">{config.stateShort}</span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[17px] font-bold text-[color:var(--theme-text)]">{config.neutralHeader}</span>
                <span className="block truncate text-[12px] text-[color:var(--theme-text-3)]">{int(model.n_total)} unique responses · {int(Number(model.meta?.n28 ?? model.cards[0]?.n ?? 0))} with a 2028 vote · {String(model.meta?.first ?? "")} to {String(model.meta?.last ?? "")}</span>
              </span>
            </div>
          ) : (
            <div className="inline-flex min-h-11! shrink-0 items-center gap-2 rounded-full border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] py-1.5 pl-1.5 pr-4">
              <span data-identity-logo className="grid size-11 place-items-center rounded-full bg-[color:var(--party-badge-surface)] ring-1 ring-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={config.identity.logo} alt={`${config.identity.name} symbol`} width={40} height={27} className="h-auto w-10 object-contain" />
              </span>
              <span className="leading-tight">
                <span className="block text-[17px] font-bold text-[color:var(--theme-text)]">{config.identity.name}</span>
                <span className="block text-[14px] text-[color:var(--theme-text-3)]">{config.identity.state}</span>
              </span>
            </div>
          )}
          {owner && (
            <button type="button" onClick={() => void download()} disabled={downloading} className="inline-flex min-h-11! items-center gap-1.5 rounded-full border border-[color:var(--theme-text)] px-4 text-[13px] font-semibold text-[color:var(--theme-text)] hover:bg-[color:var(--theme-text)] hover:text-[color:var(--theme-surface)] disabled:opacity-50 sm:ml-auto">
              <ArrowDownToLine className="size-4" /> {downloading ? "Preparing..." : "Download data"}
            </button>
          )}
          <p className={cn("w-full text-[15px] font-medium text-[color:var(--theme-text-2)] sm:w-auto sm:text-right", owner ? "sm:ml-0" : "sm:ml-auto")}>{int(model.n_total)} responses</p>
        </header>

        <div className={cn("mt-4 grid grid-cols-2 gap-3", config.singleTabBar ? "min-[900px]:grid-cols-3 min-[1280px]:grid-cols-[1.4fr_1fr_1fr_1fr_1.15fr]" : model.cards.length + 1 >= 4 ? "min-[1280px]:grid-cols-4" : model.cards.length + 1 === 3 ? "min-[1280px]:grid-cols-3" : "min-[1280px]:grid-cols-2")}>
          {model.cards.map((card) => {
            const selected = view === card.key;
            const label = card.label.replace(" (Live tracking)", "");
            const shortLabel = label.replace(/ poll$/i, "");
            const lead = leaderOf(card.expected, parties) ?? config.parties[0];
            const live = card.key === "rd";
            return (
              <button key={card.key} type="button" aria-pressed={selected} onMouseEnter={() => prefetch(card.key, card.key === "rd" ? postPollDefault : "all")} onClick={() => { setDistrict(null); setAcNo(null); navigate({ view: card.key, slot: card.key === "rd" ? postPollDefault : "all", profile: "", filter: null }); }}
                className="tn-period-card group relative flex min-h-[84px] flex-col px-2 py-[14px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--period-selected)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--theme-surface)] sm:px-4">
                {selected && <span aria-hidden className="absolute inset-x-[1px] top-[1px] h-[3px] rounded-t-[14px]" style={{ background: colour(lead) }} />}
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("min-w-0 whitespace-nowrap text-[15px] font-semibold leading-tight", selected ? "text-[color:var(--period-selected)]" : "text-[color:var(--theme-text)]")}>
                    <span className="sm:hidden">{shortLabel}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </p>
                  {live ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--theme-positive-soft)] px-1.5 py-[2px] text-[12px] font-bold leading-none text-[color:var(--theme-positive)]"><span className="tn-live-dot size-1.5 rounded-full bg-current" aria-hidden />Live</span>
                  ) : card.showAccuracy !== false ? (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-[color:var(--theme-positive-soft)] px-1.5 py-[2px] text-[12px] font-bold leading-none text-[color:var(--theme-positive)]">{(card.accuracy ?? 0).toFixed(1)}% accurate</span>
                  ) : null}
                </div>
                {card.summaryLine ? (
                  <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11px] tabular-nums text-[color:var(--theme-text-3)] sm:text-[12.5px]">
                    {parties.slice(0, 3).map((party, index) => (
                      <span key={party} className={cn("inline-flex items-center gap-1 whitespace-nowrap", index === 2 && "hidden sm:inline-flex")}>
                        <PartyBadge party={party} size={16} />
                        {partyLabel(party)} <span>{(card.expected[party] ?? 0).toFixed(1)}<span className="hidden sm:inline">%</span></span>
                      </span>
                    ))}
                    <span className="hidden sm:inline">{(() => {
                      const seatMap = card.seats ?? {};
                      const order = [...parties].sort((a, b) => Number(seatMap[b] ?? 0) - Number(seatMap[a] ?? 0));
                      const leader = order[0];
                      const leaderSeats = Number(seatMap[leader] ?? 0);
                      if (leaderSeats >= config.map.majority) return <> · <PartyBadge party={leader} size={16} /> {partyLabel(leader)} {int(leaderSeats)} of {config.map.totalSeats} (majority {config.map.majority})</>;
                      return <> · {order.slice(0, 3).map((party, index) => <span key={party} className="inline-flex items-center gap-1">{index > 0 && <span aria-hidden>·</span>}<PartyBadge party={party} size={16} />{partyLabel(party)} {int(Number(seatMap[party] ?? 0))}</span>)}, no majority ({config.map.majority} needed)</>;
                    })()}</span>
                  </p>
                ) : (
                <p className="mt-1.5 flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[13px] tabular-nums text-[color:var(--theme-text-3)]">
                  {parties.slice(0, config.cardStyle === "ap" ? 2 : 3).map((party, index) => (
                    <span key={party} className={cn("inline-flex items-center gap-1", index === 2 && "hidden sm:inline-flex")}>
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: colour(party) }} aria-hidden />
                      {party} <span>{(card.expected[party] ?? 0).toFixed(1)}<span className="hidden sm:inline">%</span></span>
                    </span>
                  ))}
                  {config.cardStyle === "ap" && card.seats && <span className="hidden sm:inline">· {int(card.seats[config.actualParties[0]] ?? 0)}–{int(card.seats[config.actualParties[1]] ?? 0)} seats</span>}
                </p>
                )}
              </button>
            );
          })}
          {config.singleTabBar && slots.filter((item) => !item.subKey).map((item) => {
            const selected = view !== "social" && slot.key === item.key;
            const itemLead = leaderOf(item.expected[config.stateName] ?? {}, parties) ?? config.parties[0];
            const itemExpected = item.expected[config.stateName] ?? {};
            const subs = slots.filter((candidate) => candidate.subKey && candidate.monthKey === item.key);
            const hint = `${int(item.n)} responses${item.from ? ` · ${item.from} to ${item.to}` : ""}${subs.length ? ` · ${subs.map((sub) => sub.buttonLabel).join(", ")}` : ""}`;
            return (
              <button key={`month-${item.key}`} type="button" aria-pressed={selected} data-month-card title={hint} onMouseEnter={() => prefetch(periodKey, item.key)} onClick={() => { setDistrict(null); setAcNo(null); navigate({ slot: item.key, profile: "" }); }}
                className="tn-period-card group relative flex min-h-[84px] flex-col px-2 py-[14px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--period-selected)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--theme-surface)] sm:px-4">
                {selected && <span aria-hidden className="absolute inset-x-[1px] top-[1px] h-[3px] rounded-t-[14px]" style={{ background: colour(itemLead) }} />}
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("min-w-0 truncate text-[15px] font-semibold leading-tight", selected ? "text-[color:var(--period-selected)]" : "text-[color:var(--theme-text)]")}>{item.buttonLabel}</p>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-[color:var(--theme-surface-2)] px-1.5 py-[2px] text-[11px] font-semibold leading-none text-[color:var(--theme-text-3)]">{int(item.n)}</span>
                </div>
                <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] tabular-nums text-[color:var(--theme-text-3)] sm:text-[13px]">
                  {parties.slice(0, config.cardStyle === "ap" ? 2 : 3).map((party, index) => (
                    <span key={party} className={cn("inline-flex items-center gap-1", index === 2 && "hidden sm:inline-flex")}>
                      <PartyBadge party={party} size={16} />
                      {partyLabel(party)} <span>{(itemExpected[party] ?? 0).toFixed(1)}<span className="hidden sm:inline">%</span></span>
                    </span>
                  ))}
                </p>
              </button>
            );
          })}
          <button type="button" aria-pressed={view === "social"} data-social-card className={cn("tn-period-card group relative flex min-h-[84px] flex-col px-2 py-[14px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--period-selected)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--theme-surface)] sm:px-4", config.singleTabBar ? "col-span-2 min-[900px]:col-span-1" : model.cards.length + 1 === 3 && "col-span-2 min-[1280px]:col-span-1")} onMouseEnter={() => prefetchSocial()} onPointerDown={() => prefetchSocial()} onFocus={() => prefetchSocial()} onClick={() => openSocial()}>
            {view === "social" && <span aria-hidden className="absolute inset-x-[1px] top-[1px] h-[3px] rounded-t-[14px]" style={{ background: colour(leaderOf(model.cards[0]?.expected ?? {}, parties) ?? config.parties[0]) }} />}
            <div className="flex items-center justify-between gap-2">
              <p data-social-title className={cn("flex min-w-0 items-center whitespace-nowrap text-[14px] font-semibold leading-tight", view === "social" ? "text-[color:var(--period-selected)]" : "text-[color:var(--theme-text)]")}>
                <span className="sm:hidden">Social</span><span className="hidden sm:inline">{config.socialCardTitle ?? "Social Media"}</span>
              </p>
              <TrendChart data={model.socialMonthly} series={[{ metric: "reach", label: "Reach", color: "var(--theme-chart-reach)" }]} height={20} label="Monthly reach" className="h-5 w-[72px] shrink-0" />
            </div>
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
              <span data-social-icons className="flex items-center"><SocialCluster iconSize={20} tileSize={22} columns={4} /></span>
              <p data-social-subtitle className="text-[12px] font-medium text-[color:var(--theme-text-3)] sm:text-[13px]"><span className="sm:hidden">Ads · reach</span><span className="hidden sm:inline">{config.socialCardSubtitle ?? "Ads · reach & engagement"}</span></p>
            </div>
          </button>
        </div>

        {!config.singleTabBar && view !== "social" && (
          <div className="mt-4 flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-[12px] font-bold uppercase tracking-[0.12em] text-[color:var(--theme-warning)]">{config.periodLabels[view] ?? config.monthLabel}</span>
            <div className="edge-fade-right no-scrollbar flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto pb-1 snap-x" role="group" aria-label="Survey time slot">
            {slots.filter((item) => !item.subKey).map((item) => {
              const itemLead = leaderOf(item.expected[config.stateName] ?? {}, parties) ?? config.parties[0];
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
                    style={{ background: slot.key === item.key || slot.monthKey === item.key ? colour(itemLead) : `color-mix(in srgb, ${colour(itemLead)} 16%, var(--theme-surface))`, color: slot.key === item.key || slot.monthKey === item.key ? (needsWhite(itemLead) ? "#fff" : "#0B0B0C") : "var(--theme-text)" }}>
                    {item.buttonLabel}{subs.length ? <ChevronDown className="ml-1 inline size-4" /> : null}
                  </button>
                </div>
              );
            })}
            {slots.filter((candidate) => candidate.subKey && candidate.monthKey === (slot.monthKey ?? "")).map((item) => {
              const subLead = leaderOf(item.expected[config.stateName] ?? {}, parties) ?? config.parties[0];
              return <Pill key={item.key} selected={slot.key === item.key} dataActive={slot.key === item.key} colour={colour(subLead)} party={subLead} label={item.buttonLabel} onMouseEnter={() => prefetch(periodKey, item.key)} onClick={(event) => {
                navigate({ slot: item.key, profile: "" });
                const strip = event.currentTarget.closest(".no-scrollbar") as HTMLElement | null;
                if (strip) {
                  const sr = strip.getBoundingClientRect(), br = event.currentTarget.getBoundingClientRect();
                  strip.scrollTo({ left: strip.scrollLeft + br.left - sr.left - (strip.clientWidth - br.width) / 2, behavior: "smooth" });
                }
              }}>{item.buttonLabel}</Pill>;
            })}
          </div>
          </div>
        )}

        {socialMounted && (
          <div className={cn("mt-4", view === "social" ? "tn-crossfade" : "hidden")}><TnSocialMedia stateSlug={config.slug} config={config} initialFilter={socialFilter} initialOverview={socialOverviewRef.current} onClose={closeSocial} owner={owner} /></div>
        )}
        <div className={view === "social" ? "hidden" : undefined}>
          <>
            {config.leaderKey?.length ? (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-[color:var(--theme-text-2)]">
                {config.leaderKey.map((item) => <span key={item.party} className="inline-flex items-center gap-1.5"><PartyBadge party={item.party} size={20} />{item.label}</span>)}
                {config.leaderKeyNote && <span className="text-[color:var(--theme-text-3)]">· {config.leaderKeyNote}</span>}
              </div>
            ) : null}
            <div tabIndex={0} role="region" aria-label="Party cards" className={cn("edge-fade-right no-scrollbar mt-4 grid grid-cols-2 gap-3 min-[640px]:flex min-[640px]:snap-x min-[640px]:overflow-x-auto min-[640px]:pb-1 min-[1100px]:grid", parties.length === 4 ? "min-[1100px]:grid-cols-4" : "min-[1100px]:grid-cols-5")}>
              {cardParties.map((party, partyIndex) => {
                const value = expected[party] ?? 0;
                const perParty = Math.max(0, 100 - Math.abs(value - (actual[party] ?? 0)));
                return (
                  <div key={party} className={cn("min-w-0 rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.03)] min-[640px]:min-w-[160px] min-[640px]:flex-1 min-[640px]:snap-start min-[1100px]:min-w-0", partyIndex === 4 && "col-span-2 min-[640px]:col-span-1")} style={{ borderTopColor: borderColour(party), borderTopWidth: 3 }}>
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--theme-text-2)]"><PartyBadge party={party} size={28} />{partyLabel(party)} · {view === "ex" ? "share" : "expected"}</p>
                    <p className="tn-number mt-1 text-[38px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[color:var(--theme-text)]"><CountUp value={value} decimals={2} suffix="%" /></p>
                    <p className="mt-1.5 text-[12.5px] font-semibold text-[color:var(--theme-negative)]">Actual {config.actualYear ?? (config.cardStyle === "ap" ? "2024" : "2026")}: {pct2(actual[party])}</p>
                    {!(config.cardStyle === "ap" && view === "rd") && <p className="mt-0.5 text-[12.5px] font-semibold text-[color:var(--theme-positive)]">Accuracy {perParty.toFixed(1)}%</p>}
                  </div>
                );
              })}
            </div>

            {config.summaryCard ? <KarnatakaSummary model={model} parties={parties} expected={expected} slot={slot} /> : null}
            {profiles.length > 0 && (
              <Section title={`${config.profileHeading ?? "Voter profile"} · ${slot.buttonLabel}`} className="mt-3">
                <PillRow label="PROFILE" ariaLabel="Voter profile" className="mt-3" wrap={config.singleTabBar}>
                  {(() => {
                    const configured = config.profileGroups?.[periodKey];
                    const groups = configured?.length
                      ? configured.map((group) => ({ label: group.label, keys: group.keys.filter((key) => profiles.includes(key)) })).filter((group) => group.keys.length)
                      : [{ label: "", keys: profiles }];
                    return groups.map((group, groupIndex) => (
                      <span key={`${group.label}-${groupIndex}`} className="contents">
                        {group.label && (
                          <span className="flex shrink-0 items-center gap-1.5 pl-1 text-[12px] font-bold uppercase tracking-[0.12em] text-[color:var(--theme-text-3)]">
                            {groupIndex > 0 && <span className="mr-1 h-5 w-px bg-[color:var(--theme-border)]" aria-hidden />}
                            {group.label}
                          </span>
                        )}
                        {group.keys.map((key) => {
                          const profileLead = weightedLeader(slot.profiles[key], parties) ?? leadParty ?? parties[0] ?? "Others";
                          return (
                            <Pill
                              key={key}
                              selected={activeProfile === key}
                              colour={colour(profileLead)}
                              party={profileLead}
                              profileTab={key}
                              label={slot.demoCatalog[key]?.label ?? key}
                              onClick={(event) => {
                                navigate({ profile: key });
                                const strip = event.currentTarget.closest(".no-scrollbar") as HTMLElement | null;
                                if (strip) {
                                  const sr = strip.getBoundingClientRect(), br = event.currentTarget.getBoundingClientRect();
                                  strip.scrollTo({ left: strip.scrollLeft + br.left - sr.left - (strip.clientWidth - br.width) / 2, behavior: "smooth" });
                                }
                              }}
                            >
                              {slot.demoCatalog[key]?.label ?? key}
                            </Pill>
                          );
                        })}
                      </span>
                    ));
                  })()}
                </PillRow>
                <div className="mt-3">
                  <LazyMount minHeight={540}>
                    {!demo && activeProfile === "ac" ? <div className="rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-3)] p-6 text-[14px] text-[color:var(--theme-text-3)]">Loading assembly table...</div> :
                      demo ? <div key={`${slot.key}:${activeProfile}`} className="tn-fade-slide"><TnProfileTable demo={demo} parties={parties} profileKey={activeProfile} periodKey={view} slotLabel={slot.label} average={average} slotLeader={leadParty ?? parties[0] ?? ""} targetParty={activeTargetParty} targetMode={targetMode} targetPillParty={config.target?.pillParty ?? config.parties[0]} targetTooltip={config.target ? (targetMode === "gap" ? config.target.tooltipGap ?? config.target.tooltipGeo : ["zone", "area", "dist", "ac"].includes(activeProfile) ? config.target.tooltipGeo : config.target.tooltipOther) : ""} allowTarget={Boolean(config.target?.periods.includes(view))} showCampaignsLink={config.showCampaignLinks ?? config.cardStyle !== "ap"} threshold={activeThreshold} countBelowThreshold={Boolean(config.countBelowThreshold)}
                        onTarget={(payload) => openSocial({ match: "target", kind: payload.kind, place: payload.place, label: `${payload.label} · ${payload.place} · ${activeTargetParty} ${targetMode === "leads" ? "leads" : `${payload.value.toFixed(1)}% (average ${payload.average.toFixed(1)})`}`, value: String(payload.value), average: String(payload.average) })}
                        onCampaigns={(payload) => openSocial({ match: "campaigns", kind: payload.kind, place: payload.place, label: payload.place })}
                        onGroup={(group) => openSocial({ match: "group", group, label: group })}
                      /></div> : null}
                  </LazyMount>
                </div>
              </Section>
            )}
            <LazyMount minHeight={380}><SwingSection data={model} swing={model.swing} parties={parties} period={view} slot={slot.key} config={config} /></LazyMount>
            {!config.hideMap && (
            <section ref={mapHostRef} className="relative mt-3 scroll-mt-28 rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.035)] sm:p-4" aria-label={`${config.stateName} map`}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-[23px] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--theme-text)]">{district ?? (acNo != null ? `Assembly constituency ${acNo}` : config.map.heading)}</h2>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(district || acNo != null) && (
                      <button type="button" onClick={() => { setDistrict(null); setAcNo(null); }} className="inline-flex min-h-11! items-center gap-1.5 rounded-full border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] px-3.5 text-[13px] font-semibold text-[color:var(--theme-text)] transition-colors hover:border-[color:var(--theme-text)] hover:bg-[color:var(--theme-surface-3)]">
                        <ArrowLeft className="size-4" /> Back to state
                      </button>
                    )}
                  </div>
                </div>
                <div className={cn("relative h-[380px] overflow-hidden rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-2)] transition-opacity md:h-[680px] xl:h-[700px]", mapLoading && "opacity-60")}>
                  {mapMounted ? (config.slug === "andhra-pradesh-2024" ? <ApMap
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
                      const row = payload.kind === "district" ? map.districtRows[payload.name] : payload.no != null ? map.acRows[String(payload.no)] : undefined;
                      const shares = row?.shares as Record<string, number> | null | undefined;
                      const ranked = parties
                        .map((party) => ({ party, value: Number(shares?.[config.map.shareKey[party] ?? party] ?? 0) * 100 }))
                        .sort((a, b) => b.value - a.value);
                      return { title: payload.name, leader: shares && ranked[0] && ranked[0].value > 0 ? ranked[0].party : null, rows: shares ? ranked : [] };
                    }}
                  /> : <TamilNaduMap
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
                        .map((party) => ({ party, value: Number(shares?.[config.map.shareKey[party] ?? party] ?? 0) * 100 }))
                        .sort((a, b) => b.value - a.value);
                      return { title: payload.name, leader: shares && ranked[0] && ranked[0].value > 0 ? ranked[0].party : null, rows: shares ? ranked : [] };
                    }}
                  />) : <div className="grid h-full place-items-center text-[14px] text-[color:var(--theme-text-3)]">Preparing map...</div>}
                  {mapLoading && <p role="status" className="absolute inset-0 grid place-items-center text-[14px] font-semibold text-[color:var(--theme-text-3)]">Loading map...</p>}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-[color:var(--theme-text-2)]">
                  {parties.map((party) => <span key={party} className="inline-flex items-center gap-1.5"><PartyBadge party={party} size={20} />{party}</span>)}
                  <span className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded-[2px] bg-[#94A3B8] ring-1 ring-inset ring-black/10" />No data / under 30</span>
                </div>
                <div className="sr-only">
                <table>
                  <caption>{config.stateName} district results</caption>
                  <thead><tr><th scope="col">District</th>{parties.map((party) => <th key={party} scope="col">{party}</th>)}</tr></thead>
                  <tbody>
                    {Object.entries(map.districtRows).map(([districtName, row]) => {
                      const shares = row?.shares as Record<string, number> | null | undefined;
                      return <tr key={districtName}><th scope="row">{districtName}</th>{parties.map((party) => <td key={party}>{shares?.[config.map.shareKey[party] ?? party] != null ? `${(Number(shares[config.map.shareKey[party] ?? party]) * 100).toFixed(1)}%` : "No data"}</td>)}</tr>;
                    })}
                  </tbody>
                </table>
                </div>
              </section>
              )}
            <LazyMount minHeight={520}><SeatsByZone data={model} parties={parties} seats={seats} periodKey={view} slotLabel={slot.label} config={config} /></LazyMount>
            {config.methodNote?.length ? (
              <Section title="Method" className="mt-3">
                <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-[color:var(--theme-text-2)]">
                  {config.methodNote.map((line) => <li key={line} className="flex gap-2"><span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-[color:var(--theme-text-3)]" />{line}</li>)}
                </ul>
              </Section>
            ) : null}
          </>
        </div>
      </div>
    </main>
  );
}


function KarnatakaSummary({ model, parties, slot }: { model: TnClientModel; parties: string[]; expected: SurveyShare; slot: TnSlotModel }) {
  const meta = (model.meta ?? {}) as Record<string, unknown>;
  const summary = (meta.summary ?? {}) as { latestEntry?: string; pastVote?: Record<string, { INC: number; BJP: number; JDS: number; Others: number; seats: number[]; majority: string | null }> };
  const pastVote = summary.pastVote ?? {};
  const all = model.slots.rd?.find((item) => item.key === "all") ?? slot;
  const months = (model.slots.rd ?? []).filter((item) => item.key !== "all" && !item.subKey).sort((a, b) => b.key.localeCompare(a.key));
  const rows = [all, ...months];
  const display = (party: string) => party === "JDS" ? "JD(S)" : party;
  const suffix = (seats: number[]) => {
    const leader = seats[0] >= seats[1] && seats[0] >= seats[2] && seats[0] >= seats[3] ? "INC" : seats[1] >= seats[0] && seats[1] >= seats[2] && seats[1] >= seats[3] ? "BJP" : seats[2] >= seats[0] && seats[2] >= seats[1] && seats[2] >= seats[3] ? "JD(S)" : "Others";
    const max = Math.max(...seats);
    return max >= 113 ? `(majority ${leader})` : "(hung)";
  };
  const pv = (key: string) => {
    if (key === "all") {
      const values = meta.pv as Record<string, number> | undefined;
      const seats = meta.pv_seats as Record<string, number> | undefined;
      if (!values || !seats) return null;
      return { INC: values.pv_INC, BJP: values.pv_BJP, JDS: values.pv_JDS, Others: values.pv_Others, seats: [seats.INC, seats.BJP, seats.JDS, seats.Others], majority: null };
    }
    return pastVote[key] ?? null;
  };
  return (
    <Section title="Data & projection summary" className="mt-3">
      <p className="mt-3 text-[13px] leading-relaxed text-[color:var(--theme-text-2)]"><b className="text-[color:var(--theme-text)]">Data:</b> {Number(meta.kept ?? model.n_total).toLocaleString("en-IN")} unique respondents ({Number(meta.raw ?? 0).toLocaleString("en-IN")} rows, {Number(meta.dups ?? 0).toLocaleString("en-IN")} repeats removed); {Number(meta.n28 ?? 0).toLocaleString("en-IN")} answered the 2028 vote; {Number(meta.both ?? 0).toLocaleString("en-IN")} answered both 2023 and 2028. The latest entry is {summary.latestEntry ?? "not stated"}.</p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-[color:var(--theme-border)]" tabIndex={0} role="region" aria-label="Karnataka projection summary">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <thead className="bg-[color:var(--theme-surface-3)] text-left text-[11px] uppercase tracking-wide text-[color:var(--theme-text-3)]"><tr><th className="px-3 py-2.5">Period</th><th className="px-3 py-2.5 text-right">Answers</th><th className="px-3 py-2.5">Projection</th>{["INC", "BJP", "JDS"].map((party) => <th key={party} className="px-3 py-2.5 text-right"><span className="inline-flex items-center gap-1.5"><PartyBadge party={party} size={18} />{display(party)}</span></th>)}<th className="px-3 py-2.5 text-right">Seats</th></tr></thead>
          <tbody>
            {rows.map((item) => {
              const methodVote = item.expected.Karnataka ?? {};
              const methodSeats = [Number((item.seats as Record<string, unknown>).INC ?? 0), Number((item.seats as Record<string, unknown>).BJP ?? 0), Number((item.seats as Record<string, unknown>).JDS ?? 0), Number((item.seats as Record<string, unknown>).Others ?? 0)];
              const weighted = pv(item.key);
              const weightedVote = weighted ? weighted : null;
              const weightedSeats = weighted?.seats ?? null;
              return (
                <Fragment key={item.key}>
                  <tr className="border-t border-[color:var(--theme-border)]">
                    <th scope="row" rowSpan={2} className="px-3 py-2.5 text-left font-semibold">{item.key === "all" ? "All months" : item.buttonLabel}</th>
                    <td rowSpan={2} className="px-3 py-2.5 text-right tabular-nums">{int(item.n)}</td>
                    <td className="px-3 py-2 text-[color:var(--theme-text-2)]">2023 result + swing</td>
                    {["INC", "BJP", "JDS"].map((party) => <td key={party} className="px-3 py-2 text-right tabular-nums">{Number(methodVote[party] ?? 0).toFixed(1)}%</td>)}
                    <td className="px-3 py-2 text-right tabular-nums">{methodSeats.slice(0, 3).join(" – ")} <span className="text-[color:var(--theme-text-3)]">{suffix(methodSeats)}</span></td>
                  </tr>
                  <tr className="border-t border-[color:var(--theme-border)]">
                    <td className="px-3 py-2 text-[color:var(--theme-text-2)]">Past-vote weighted</td>
                    {["INC", "BJP", "JDS"].map((party) => <td key={party} className="px-3 py-2 text-right tabular-nums">{weightedVote ? `${Number(weightedVote[party as keyof typeof weightedVote] ?? 0).toFixed(1)}%` : "—"}</td>)}
                    <td className="px-3 py-2 text-right tabular-nums">{weightedSeats ? <>{weightedSeats.slice(0, 3).join(" – ")} <span className="text-[color:var(--theme-text-3)]">{suffix(weightedSeats)}</span></> : "—"}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-[color:var(--theme-text-3)]">Majority 113 of 224 · actual 2023: INC 135, BJP 66, JD(S) 19, Others 4. 2023 result + swing uses the payload expected shares and seats. Past-vote weighted re-weights the 2023 recall to the actual result and each community to its population share. Seats use the region model on the actual 2023 assembly result. The source card shows Nov BJP 87 and Others 9, and Oct INC 89 and BJP 105; the payload values BJP 88 and Others 8, and INC 90 and BJP 104, are used here.</p>
    </Section>
  );
}

function SwingSection({ data, swing, parties, period, slot, config }: { data: TnClientModel; swing: TnSwingPayload; parties: string[]; period: string; slot: string; config: CaseStudyConfig }) {
  const state = config.stateName;
  const sources = swing.sources[period] ?? [];
  const source = sources.find((item) => item.key === slot) ?? sources[0];
  if (!source) return <Section title={`${config.cardStyle === "ap" ? "Region swing" : "Zone swing"} · ${period === "ex" ? "Exit poll" : "Opinion poll"}`} className="mt-3"><p className="mt-2 text-[14px] text-[color:var(--theme-text-3)]">No swing data in this upload.</p></Section>;
  const fromLabel = config.swing.fromLabel[period] ?? "";
  const showActual = config.swing.showActual.includes(period);
  return (
    <Section title={`${config.cardStyle === "ap" ? "Region swing" : "Zone swing"} · ${source.label}`} className="mt-3">
      <div className="edge-fade-right mt-3 overflow-x-auto rounded-xl border border-[color:var(--theme-border)]" tabIndex={0} role="region" aria-label={`${config.cardStyle === "ap" ? "Region" : "Zone"} swing table`}>
        <table className="w-full min-w-[980px] border-collapse text-[15px]">
          <thead className="bg-[color:var(--theme-surface-3)] text-left text-[13px] uppercase tracking-wide text-[color:var(--theme-text-3)]"><tr><th scope="col" className="px-4 py-3">{config.cardStyle === "ap" ? "Region" : "Zone"}</th>{parties.map((party) => <th key={party} scope="col" className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1.5"><PartyBadge party={party} size={20} />{displayParty(config, party)} {fromLabel}</span></th>)}</tr></thead>
          <tbody>
            {data.regions.map((region) => {
              const before = source.base?.[region] ?? data.base?.[region] ?? TN_2021_BASE[region as keyof typeof TN_2021_BASE];
              const after = source.expected[region];
              if (!before || !after) return null;
              return (
                <tr key={region} className={cn("border-t border-[color:var(--theme-border)]", region === state && "font-bold")}>
                  <th scope="row" className="sticky left-0 z-10 bg-[color:var(--theme-surface)] px-4 py-2.5 text-left">{data.zonelabels?.[region] ?? region}</th>
                  {parties.map((party) => {
                    const swing = (after[party] ?? 0) - (before[party] ?? 0);
                    const tone = swingTone(swing);
                    return <td key={party} className="px-4 py-2.5 text-center tabular-nums">{pct(before[party])} → {pct(after[party])} <span className={cn("ml-1 rounded px-1.5 py-0.5 text-[12px] font-bold", tone === "up" ? "bg-[color:var(--theme-positive-soft)] text-[color:var(--theme-positive)]" : tone === "down" ? "bg-[color:var(--theme-negative-soft)] text-[color:var(--theme-negative)]" : "text-[color:var(--theme-text-3)]")}>{swingLabel(swing)}</span>{showActual && region === state && data.actual[region]?.[party] != null && <span className="mt-0.5 block text-[12px] font-bold text-[color:var(--theme-negative)]">Actual {config.actualYear ?? (config.cardStyle === "ap" ? "2024" : "2026")}: {pct(data.actual[region][party])}</span>}</td>;
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

function SeatsByZone({ data, parties, seats, periodKey, slotLabel, config }: { data: TnClientModel; parties: string[]; seats: Record<string, unknown>; periodKey: string; slotLabel: string; config: CaseStudyConfig }) {
  const zones = (seats.zones as Record<string, Record<string, unknown>> | undefined) ?? {};
  const actualZones = (data.actualZones as Record<string, Record<string, unknown>> | undefined) ?? {};
  const actualSeats = data.actualSeats as Record<string, unknown>;
  const summaryParties = config.seatParties;
  const actualParties = config.actualParties;
  const majority = projectedMajority(seats, summaryParties, config.map.majority);
  const showActualColumns = config.cardStyle !== "ap";
  const compactSeatTable = !showActualColumns;
  const numberColumns = summaryParties.length + (showActualColumns ? actualParties.length : 0);
  const zoneWidth = compactSeatTable ? 34 : 26;
  const acsWidth = compactSeatTable ? 11 : 9;
  return (
    <Section title={`${config.seatsHeading ?? "Seats by zone"} · ${slotLabel}`} className="mt-3">
      <div className={cn("mt-3 grid gap-3", summaryParties.length === 2 ? "grid-cols-2" : summaryParties.length >= 5 ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4")}>
        {summaryParties.map((party) => (
          <div key={party} className="rounded-xl border border-[color:var(--theme-border)] p-4">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--theme-text-2)]"><PartyBadge party={party} size={28} />{displayParty(config, party)}</p>
            <p className="mt-1 font-display text-[32px] font-semibold leading-none tabular-nums text-[color:var(--theme-text)]"><CountUp value={Number(seats[party] ?? 0)} /></p>
            <p className="mt-1.5 text-[12.5px] text-[color:var(--theme-text-3)]">projected · actual {int(Number(actualSeats[party] ?? 0))}</p>
          </div>
        ))}
      </div>
      <div className={cn("mt-3 overflow-x-auto rounded-xl border border-[color:var(--theme-border)]", !compactSeatTable && "edge-fade-right")} tabIndex={0} role="region" aria-label={`${config.cardStyle === "ap" ? "Seats by region" : "Seats by zone"} table`}>
        <table className={cn("w-full table-fixed border-collapse text-[15px]", showActualColumns ? "min-w-[1080px]" : summaryParties.length >= 5 ? "min-w-[720px]" : "min-w-0")} aria-label={majority.status === "majority" ? `${majority.leader} projected majority with ${majority.seats} seats` : "Projected assembly is hung"}>
          <colgroup>
            <col style={{ width: `${zoneWidth}%` }} />
            <col style={{ width: `${acsWidth}%` }} />
            {Array.from({ length: numberColumns }, (_value, index) => (
              <col key={index} style={{ width: `${(100 - zoneWidth - acsWidth) / numberColumns}%` }} />
            ))}
          </colgroup>
          <thead className="bg-[color:var(--theme-surface-3)] text-left text-[13px] uppercase tracking-wide text-[color:var(--theme-text-3)]">
            <tr><th rowSpan={2} className="break-words px-1.5 py-3 text-[13.5px] sm:px-4 sm:text-[13px]">Zone</th><th rowSpan={2} className="px-1.5 py-3 text-right sm:px-3">ACs</th><th colSpan={summaryParties.length} className="px-4 py-3 text-center">Projected</th>{showActualColumns && <th colSpan={actualParties.length} className="px-4 py-3 text-center">Actual {config.actualYear ?? (config.cardStyle === "ap" ? "2024" : "2026")}</th>}</tr>
            <tr>{summaryParties.map((party) => <th key={party} className="px-1.5 py-2 text-right sm:px-3"><span className="inline-flex items-center gap-1.5 whitespace-nowrap"><PartyBadge party={party} size={20} />{displayParty(config, party)}</span></th>)}{showActualColumns && actualParties.map((party) => <th key={party} className="px-1.5 py-2 text-right sm:px-3"><span className="inline-flex items-center gap-1.5 whitespace-nowrap"><PartyBadge party={party} size={20} />{displayParty(config, party)}</span></th>)}</tr>
          </thead>
          <tbody>
            {Object.entries(zones).map(([zone, row]) => (
              <tr key={zone} className="border-t border-[color:var(--theme-border)]">
                <th scope="row" className="break-words px-1.5 py-2.5 text-left text-[13.5px] font-semibold sm:px-4 sm:text-[15px]">{data.zonelabels?.[zone] ?? zone}</th>
                <td className="px-1.5 py-2.5 text-right tabular-nums sm:px-3">{int(Number(row.acs ?? 0))}</td>
                {summaryParties.map((party) => <td key={party} className="px-1.5 py-2.5 text-right tabular-nums sm:px-3">{int(Number(row[party] ?? 0))}</td>)}
                {showActualColumns && actualParties.map((party) => <td key={party} className="px-1.5 py-2.5 text-right tabular-nums sm:px-3">{int(Number(actualZones[zone]?.[party] ?? 0))}</td>)}
              </tr>
            ))}
            <tr className="border-t-2 border-[color:var(--theme-text)] font-bold">
              <th scope="row" className="break-words px-1.5 py-3 text-left text-[13.5px] sm:px-4 sm:text-[15px]">{config.stateName}</th>
              <td className="px-1.5 py-3 text-right tabular-nums sm:px-3">{config.map.totalSeats}</td>
              {summaryParties.map((party) => <td key={party} className="px-1.5 py-3 text-right tabular-nums sm:px-3">{int(Number(seats[party] ?? 0))}</td>)}
              {showActualColumns && actualParties.map((party) => <td key={party} className="px-1.5 py-3 text-right tabular-nums sm:px-3">{int(Number(actualSeats[party] ?? 0))}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </Section>
  );
}
