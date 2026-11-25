"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, ClipboardCheck, Megaphone } from "lucide-react";
import { PartyMark } from "@/components/site/party-mark";
import type { CaseTab } from "@/lib/cases";
import type { PartyId } from "@/lib/parties";
import { cn } from "@/lib/utils";

const META: Record<CaseTab, { label: string; Icon: typeof BarChart3 }> = {
  exit: { label: "Exit Poll", Icon: ClipboardCheck },
  opinion: { label: "Opinion Poll", Icon: BarChart3 },
  social: { label: "Social Media", Icon: Megaphone },
};

export default function CaseStudyTabs({
  tabs,
  panels,
  initialTab,
  party,
  stateName,
}: {
  tabs: CaseTab[];
  panels: Partial<Record<CaseTab, ReactNode>>;
  initialTab: CaseTab;
  party?: PartyId;
  stateName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<CaseTab>(initialTab);
  const [visited, setVisited] = useState<CaseTab[]>(initialTab === "social" ? [initialTab] : [initialTab]);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const scrollKey = `ro:case-scroll:${pathname}`;
  const scrollByTab = useRef<Record<string, number>>((() => {
    try { return { ...JSON.parse(sessionStorage.getItem(`ro:case-scroll:${pathname}`) ?? "{}") }; } catch { return {}; }
  })());
  const previousTab = useRef<CaseTab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
    setVisited((previous) => previous.includes(initialTab) ? previous : [...previous, initialTab]);
  }, [initialTab]);

  useLayoutEffect(() => {
    if (previousTab.current === tab) return;
    const y = scrollByTab.current[tab] ?? 0;
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

  const select = useCallback((next: CaseTab) => {
    scrollByTab.current[tab] = window.scrollY;
    try { sessionStorage.setItem(scrollKey, JSON.stringify(scrollByTab.current)); } catch { /* storage can be blocked */ }
    setTab(next);
    setVisited((previous) => previous.includes(next) ? previous : [...previous, next]);
    const params = new URLSearchParams(window.location.search);
    params.set("view", next);
    if (next !== "opinion") { params.delete("expand"); params.delete("reason"); }
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [pathname, router, scrollKey, tab]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.indexOf(tab);
    let next = current;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % tabs.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    select(tabs[next]);
    buttons.current[next]?.focus();
  };

  const index = Math.max(0, tabs.indexOf(tab));
  const count = tabs.length;

  return (
    <>
      <div className="case-study-top-spacer pt-16">
        <div className="case-study-switch-bar sticky top-16 z-30 border-b border-[color:var(--theme-border)] bg-[color:var(--theme-surface)]/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-center px-4 sm:px-6 lg:px-10">
            <div
              role="tablist"
              aria-label="Case study views"
              onKeyDown={onKeyDown}
              className={cn("relative flex h-10 w-full items-center rounded-full bg-[color:var(--theme-surface-2)] p-1", count === 3 ? "lg:w-[420px]" : "lg:w-[300px]")}
            >
              <span
                aria-hidden
                className="case-tab-pill pointer-events-none absolute inset-y-1 left-1 rounded-full bg-[color:var(--theme-surface)] shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_12px_rgba(0,0,0,.05)] transition-transform duration-[180ms] ease-out"
                style={{ width: `calc((100% - 8px) / ${count})`, transform: `translateX(${index * 100}%)` }}
              />
              {tabs.map((id, i) => {
                const { label, Icon } = META[id];
                return (
                  <button
                    key={id}
                    ref={(node) => { buttons.current[i] = node; }}
                    type="button"
                    role="tab"
                    id={`case-tab-${id}`}
                    aria-selected={tab === id}
                    aria-controls={`case-panel-${id}`}
                    tabIndex={tab === id ? 0 : -1}
                    onClick={() => select(id)}
                    className={cn(
                      "relative z-10 flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-1 text-[12px] font-semibold transition-colors after:absolute after:inset-x-0 after:inset-y-[-4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--theme-link)]",
                      tab === id ? "text-[color:var(--theme-text)]" : "text-[color:var(--theme-text-2)] hover:text-[color:var(--theme-text)]",
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6">
        {tabs.filter((id) => visited.includes(id)).map((id) => (
          <div
            key={id}
            id={`case-panel-${id}`}
            role="tabpanel"
            aria-labelledby={`case-tab-${id}`}
            hidden={tab !== id}
            data-active={tab === id || undefined}
            className="case-tab-panel"
          >
            {id === "social" ? (
              <div className="mx-auto w-full max-w-[1200px] px-4 pb-16 sm:px-6">
                <div className="flex items-center gap-3 border-b border-[color:var(--theme-border)] pb-5">
                  {party && (
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--party-badge-surface)]">
                      <PartyMark party={party} size="sm" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <h2 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--theme-text)]">Social Media</h2>
                    <p className="mt-0.5 truncate text-[12px] text-[color:var(--theme-text-2)]">{stateName ?? "All regions"}</p>
                  </div>
                </div>
                <div className="case-social pt-6">{panels.social}</div>
              </div>
            ) : panels[id]}
          </div>
        ))}
      </div>
    </>
  );
}
