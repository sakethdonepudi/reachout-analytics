"use client";

import { startTransition, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function CaseStudyTabs({ children, social }: { children: ReactNode; social: ReactNode }) {
  const [tab, setTab] = useState<"overview" | "social">("overview");
  const [openedSocial, setOpenedSocial] = useState(false);

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
        <div className="mx-auto flex max-w-6xl gap-1 px-6 sm:px-10" role="tablist" aria-label="Case study views">
          {(["overview", "social"] as const).map((id) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => select(id)} className={cn("min-h-10 border-b-2 px-3 text-[12px] font-semibold", tab === id ? "border-[var(--accent-brass)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-muted)]")}>{id === "overview" ? "Overview" : "Social Media"}</button>
          ))}
        </div>
      </div>
      <div hidden={tab !== "overview"} style={{ contentVisibility: tab === "overview" ? "visible" : "hidden" }}>{children}</div>
      {openedSocial && <div hidden={tab !== "social"} style={{ contentVisibility: tab === "social" ? "visible" : "hidden" }}>{social}</div>}
    </>
  );
}
