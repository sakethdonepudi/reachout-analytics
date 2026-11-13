"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/site/brand";
import { cn } from "@/lib/utils";

const NODES: [number, number][] = [
  [88, 172], [98, 142], [120, 121], [148, 110], [178, 106], [208, 111], [233, 124],
  [252, 145], [261, 171], [254, 199], [235, 220], [210, 232], [180, 237], [150, 232],
  [126, 220], [105, 200],
];

const LINE = `M ${NODES.map(([x, y]) => `${x} ${y}`).join(" L ")} Z`;
const CONTOURS = [
  "M 78 174 L 92 134 L 132 103 L 180 92 L 228 103 L 268 134 L 282 174 L 268 214 L 228 245 L 180 256 L 132 245 L 92 214 Z",
  "M 102 172 L 114 146 L 146 126 L 180 120 L 214 126 L 246 146 L 258 172 L 246 198 L 214 218 L 180 224 L 146 218 L 114 198 Z",
  "M 126 171 L 134 157 L 157 145 L 180 141 L 203 145 L 226 157 L 234 171 L 226 185 L 203 197 L 180 201 L 157 197 L 134 185 Z",
];

export default function SignalLoader({ label, active = true, delay = 250, theme = "light" }: { label: string; active?: boolean; delay?: number; theme?: "light" | "dark" }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!active) { setShown(false); return; }
    const timer = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(timer);
  }, [active, delay]);

  if (!shown) return null;

  return (
    <div className={cn("signal-loader", theme === "dark" && "signal-loader--dark")} data-testid="signal-loader" role="status" aria-live="polite" aria-atomic="true">
      <span className="sr-only">{label}</span>
      <div className="signal-loader__top" aria-hidden="true">
        <Logo linked={false} className="h-5 w-24 sm:h-6 sm:w-28" />
        <span>Election intelligence</span>
      </div>

      <div className="signal-loader__stage" aria-hidden="true">
        <svg viewBox="0 0 360 310" className="signal-loader__art" focusable="false">
          <g className="signal-loader__contours" fill="none" stroke="#1f4e78" strokeWidth="0.9">
            {CONTOURS.map((d, index) => <path key={d} d={d} pathLength={1} className="signal-loader__contour" style={{ animationDelay: `${120 + index * 90}ms` }} />)}
          </g>
          <g className="signal-loader__network">
            <path d={LINE} pathLength={1} className="signal-loader__line" fill="none" stroke="#1714f5" strokeWidth="1.5" />
            {NODES.map(([x, y], index) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.7" fill="#1714f5" className="signal-loader__node" style={{ animationDelay: `${index * 18}ms` }} />)}
          </g>
          <circle className="signal-loader__pulse" cx="180" cy="160" r="82" fill="none" stroke="#c9fa00" strokeWidth="3" />
          <g transform="translate(82 54) scale(0.68)">
            <g className="signal-loader__mark" fill="#1714f5" stroke="#1f4e78" strokeWidth="3" strokeLinejoin="round">
              <path d="M8 0H187C241 0 274 32 274 78C274 112 260 137 235 153L194 107C206 102 212 92 212 81C212 66 202 58 186 58H59Z" />
              <path d="M88 90H157L290 268H210Z" />
              <path d="M4 199L78 135V190L4 253Z" />
              <path d="M4 268L78 203V268Z" fill="#c9fa00" />
            </g>
          </g>
        </svg>
      </div>

      <div className="signal-loader__copy" aria-hidden="true">
        <p className="signal-loader__label">{label}</p>
        <div className="signal-loader__dots"><span /><span /><span /></div>
      </div>
    </div>
  );
}
