"use client";

import { startTransition, useEffect, useRef, useState, type ReactNode } from "react";
import { useSlidingUnderline } from "@/components/ui/use-sliding-underline";
import { cn } from "@/lib/utils";

export default function CaseStudyTabs({ children, social }: { children: ReactNode; social: ReactNode }) {
  const [tab, setTab] = useState<"overview" | "social">("overview");
  const [openedSocial, setOpenedSocial] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const underline = useSlidingUnderline(tabsRef, tab);

  useEffect(() => {
    if (tab === "social") setOpenedSocial(true);
  }, [tab]);

  function select(next: "overview" | "social") {
    startTransition(() => {
      setTab(next);
      if (next === "social") setOpenedSocial(true);
    });
  }

  return (
    <>
      <div className="sticky top-[56px] z-20 border-b border-[var(--border-hairline)] bg-[var(--surface-canvas)]">
        <div ref={tabsRef} className="relative mx-auto flex max-w-6xl gap-1 px-6 sm:px-10" role="tablist" aria-label="Case study views">
          {(["overview", "social"] as const).map((id) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} data-tab-active={tab === id || undefined} onClick={() => select(id)} className={cn("min-h-10 px-3 text-[12px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brass)]/45", tab === id ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]")}>{id === "overview" ? "Overview" : "Social Media"}</button>
          ))}
          {underline && <span className="tab-underline" style={{ transform: `translateX(${underline.left}px)`, width: underline.width }} aria-hidden />}
        </div>
      </div>
      <div hidden={tab !== "overview"} style={{ contentVisibility: tab === "overview" ? "visible" : "hidden" }}>{children}</div>
      {openedSocial && <div hidden={tab !== "social"} style={{ contentVisibility: tab === "social" ? "visible" : "hidden" }}>{social}</div>}
    </>
  );
}
