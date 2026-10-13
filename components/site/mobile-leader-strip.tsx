"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import LeaderDisc from "@/components/site/leader-disc";
import { LEADERS } from "@/lib/cases";

/**
 * Compact, touch-friendly leader carousel for mobile: one clear active card with
 * neighbour previews, native swipe and accessible previous/next controls.
 */
export default function MobileLeaderStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.72, behavior: "smooth" });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">Leaders</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => scroll(-1)} aria-label="Previous leader"
            className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/5 text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" onClick={() => scroll(1)} aria-label="Next leader"
            className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/5 text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: "pan-x" }}
      >
        {LEADERS.map((l) => (
          <div key={l.id} className="w-[132px] shrink-0 snap-center px-1">
            <LeaderDisc leader={l} size={112} ring />
            <div className="mt-2.5 px-1 text-center">
              <p className="font-display text-[12px] font-semibold leading-tight text-white">{l.name}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-white/60">{l.party} · {l.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
