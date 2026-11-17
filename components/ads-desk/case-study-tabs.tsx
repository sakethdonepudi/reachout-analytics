"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Megaphone } from "lucide-react";
import { PartyMark } from "@/components/site/party-mark";
import type { PartyId } from "@/lib/parties";
import { cn } from "@/lib/utils";

type Tab = "polls" | "social";

const TABS: { id: Tab; label: string; Icon: typeof BarChart3 }[] = [
  { id: "polls", label: "Polls", Icon: BarChart3 },
  { id: "social", label: "Social Media", Icon: Megaphone },
];

export default function CaseStudyTabs({
  children,
  social,
  initialTab = "polls",
  party,
  stateName,
}: {
  children: ReactNode;
  social: ReactNode;
  initialTab?: Tab;
  party?: PartyId;
  stateName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [openedSocial, setOpenedSocial] = useState(initialTab === "social");
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const scrollKey = `ro:case-scroll:${pathname}`;
  const scrollByTab = useRef<Record<Tab, number>>((() => {
    try { return { polls: 0, social: 0, ...JSON.parse(sessionStorage.getItem(`ro:case-scroll:${pathname}`) ?? "{}") }; } catch { return { polls: 0, social: 0 }; }
  })());
  const previousTab = useRef<Tab>(initialTab);

  useEffect(() => {
    if (initialTab === "social") setOpenedSocial(true);
    setTab(initialTab);
  }, [initialTab]);

  useLayoutEffect(() => {
    if (previousTab.current === tab) return;
    const y = scrollByTab.current[tab];
    previousTab.current = tab;
    const restore = () => {
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo({ top: Math.min(y, max), behavior: "instant" });
    };
    restore();
    const frame = requestAnimationFrame(restore);
    const timer = window.setTimeout(restore, 180);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [tab]);

  const select = useCallback((next: Tab) => {
    if (next === tab) return;
    scrollByTab.current[tab] = window.scrollY;
    try { sessionStorage.setItem(scrollKey, JSON.stringify(scrollByTab.current)); } catch { /* storage can be blocked */ }
    setTab(next);
    if (next === "social") setOpenedSocial(true);
    const params = new URLSearchParams(window.location.search);
    if (next === "social") params.set("view", "social");
    else params.delete("view");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [pathname, router, scrollKey, tab]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = TABS.findIndex((item) => item.id === tab);
    let next = current;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % TABS.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    select(TABS[next].id);
    buttons.current[next]?.focus();
  };

  return (
    <>
      <div className="pt-16">
        <div className="sticky top-16 z-30 border-b border-[#EAEAEA] bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-center px-4 sm:px-6 lg:px-10">
            <div
              role="tablist"
              aria-label="Case study views"
              onKeyDown={onKeyDown}
              className="relative flex h-10 w-full items-center rounded-full bg-[#F4F4F5] p-1 lg:w-[300px]"
            >
              <span
                aria-hidden
                className={cn(
                  "case-tab-pill pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_12px_rgba(0,0,0,.05)] transition-transform duration-[180ms] ease-out",
                  tab === "social" && "translate-x-full",
                )}
              />
              {TABS.map(({ id, label, Icon }, index) => (
                <button
                  key={id}
                  ref={(node) => { buttons.current[index] = node; }}
                  type="button"
                  role="tab"
                  id={`case-tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls={`case-panel-${id}`}
                  tabIndex={tab === id ? 0 : -1}
                  onClick={() => select(id)}
                  className={cn(
                    "relative z-10 flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold transition-colors after:absolute after:inset-x-0 after:inset-y-[-4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0B0B0C]/60",
                    tab === id ? "text-[#0B0B0C]" : "text-[#6B6B6B] hover:text-[#0B0B0C]",
                  )}
                >
                  <Icon className="size-3.5" strokeWidth={1.9} aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6">
        <div
          id="case-panel-polls"
          role="tabpanel"
          aria-labelledby="case-tab-polls"
          hidden={tab !== "polls"}
          data-active={tab === "polls" || undefined}
          className="case-tab-panel"
        >
          {children}
        </div>
        {openedSocial && (
          <div
            id="case-panel-social"
            role="tabpanel"
            aria-labelledby="case-tab-social"
            hidden={tab !== "social"}
            data-active={tab === "social" || undefined}
            className="case-tab-panel"
          >
            <div className="mx-auto w-full max-w-[1200px] px-4 pb-16 sm:px-6">
              <div className="flex items-center gap-3 border-b border-[#EAEAEA] pb-5">
                {party && (
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#E6E6E6] bg-white">
                    <PartyMark party={party} size="sm" />
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[#0B0B0C]">Social Media</h2>
                  <p className="mt-0.5 truncate text-[12px] text-[#6B6B6B]">{stateName ?? "All regions"}</p>
                </div>
              </div>
              <div className="case-social pt-6">{social}</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
