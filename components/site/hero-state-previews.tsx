"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PartyMark } from "@/components/site/party-mark";
import { CASES, caseUrl } from "@/lib/cases";
import { cn } from "@/lib/utils";

const PREVIEW_SLUGS = ["tamil-nadu", "telangana", "andhra-pradesh-2024"];

/** Small, public state previews that straighten as they enter the viewport. */
export default function HeroStatePreviews({ className }: { className?: string }) {
  const [flat, setFlat] = useState(false);
  const previews = PREVIEW_SLUGS.map((slug) => CASES.find((item) => item.slug === slug)).filter((item): item is (typeof CASES)[number] => Boolean(item));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFlat(true);
      return;
    }
    const onScroll = () => {
      if (window.scrollY > 48) {
        setFlat(true);
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={cn("relative mx-auto w-full max-w-[760px]", className)}>
      <div className="mb-3 flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">
        <span className="size-1.5 rounded-full bg-[#c9a25e]" aria-hidden />
        From the case studies
      </div>
      <div className="grid grid-cols-3 items-stretch gap-2 lg:flex lg:items-end lg:justify-center lg:gap-0">
        {previews.map((item, index) => (
          <Link
            key={item.slug}
            href={caseUrl(item.slug)}
            className={cn(
              "hero-preview-card group relative flex min-w-0 flex-col justify-between rounded-2xl border border-[rgba(24,21,18,.55)] bg-[linear-gradient(180deg,#fbf7ee,#f3ebda)] p-2.5 text-[#1c1a16] shadow-[3px_4px_0_rgba(20,18,16,.22)] transition-transform duration-700 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a67c3e]/50 sm:p-4 lg:w-[210px]",
              index === 1 && "lg:-translate-y-2",
              index > 0 && "lg:-ml-9",
              !flat && (index === 0 ? "lg:-rotate-[6deg]" : index === 1 ? "lg:-rotate-[1deg]" : "lg:rotate-[6deg]"),
              flat && "lg:rotate-0",
            )}
            style={{ zIndex: index + 1 }}
          >
            <div className="flex items-start">
              <PartyMark party={item.party} size="sm" />
            </div>
            <div className="mt-2.5">
              <p className="font-display text-[12.5px] font-semibold leading-tight tracking-[-0.02em] sm:text-[16px]">{item.stateName}</p>
              <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#6b6457] sm:text-[10px]">{item.party}</p>
            </div>
            <span className="mt-2.5 hidden items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] sm:inline-flex">
              View <span className="text-[#a67c3e]">↗</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
