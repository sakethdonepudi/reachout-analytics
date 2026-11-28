"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import { cn } from "@/lib/utils";

const int = (value: number) => new Intl.NumberFormat("en-IN").format(Math.round(value));

function useCountUp(target: number, reduced: boolean) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduced) { setShown(target); return; }
    let frame = 0;
    const started = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / 1200);
      setShown(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(step);
      else setShown(target);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [reduced, target]);
  return shown;
}

function Shimmer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("live-shimmer live-anim", className)}>
      <span aria-hidden className="live-shimmer-layer" />
      <span className="live-shimmer-text">{children}</span>
    </span>
  );
}

export default function LiveHeader({
  stateShort,
  title,
  total,
  withVote,
  first,
  last,
}: {
  stateShort: string;
  title: string;
  total: number;
  withVote: number;
  first: string;
  last: string;
}) {
  const reduced = usePrefersReducedMotion();
  const totalShown = useCountUp(total, reduced);
  const voteShown = useCountUp(withVote, reduced);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      if (document.hidden) root.dataset.tabHidden = "true";
      else delete root.dataset.tabHidden;
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      delete root.dataset.tabHidden;
    };
  }, []);

  return (
    <div className="live-header inline-flex min-h-11! min-w-0 shrink items-center gap-2 rounded-full border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] py-1.5 pl-1.5 pr-4">
      <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-[color:var(--party-badge-surface)] text-[11px] font-bold uppercase tracking-[0.08em] text-[#0b0b0c] ring-1 ring-black/5">
        <span aria-hidden className="live-state-ring live-anim absolute -inset-1 rounded-full border border-[color:var(--live-green)]" />
        <span className="relative z-10">{stateShort}</span>
      </span>
      <span className="min-w-0 leading-tight">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="block text-[15px] font-bold leading-tight text-[color:var(--theme-text)] sm:text-[17px]">{title}</span>
          <span className="live-pill inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold leading-none">
            <span className="relative grid size-2 shrink-0 place-items-center">
              <span aria-hidden className="live-ping live-anim absolute inset-0 rounded-full border border-[color:var(--live-green)]" />
              <span aria-hidden className="relative size-1.5 rounded-full bg-[color:var(--live-green)]" />
            </span>
            <span><b className="font-bold">LIVE</b> · Data collection in progress</span>
          </span>
        </span>
        <span className="live-subline mt-0.5 block text-[11px] leading-snug text-[color:var(--theme-text-3)] sm:text-[12px]">
          <Shimmer className="live-number-wrap"><span className="live-number" style={{ minWidth: `${int(total).length}ch` }}>{int(totalShown)}</span></Shimmer> unique responses ·{" "}
          <Shimmer className="live-number-wrap"><span className="live-number" style={{ minWidth: `${int(withVote).length}ch` }}>{int(voteShown)}</span></Shimmer> with a 2028 vote · {first} to <Shimmer>{last}</Shimmer>
        </span>
      </span>
    </div>
  );
}
