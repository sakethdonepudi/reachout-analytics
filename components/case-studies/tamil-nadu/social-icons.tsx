"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

const BRAND_ICONS = [
  { label: "Facebook", render: (size: number) => <svg viewBox="0 0 24 24" width={size} height={size} fill="#1877F2"><path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.7V4.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.4V14h2.7v8h3.4Z" /></svg> },
  { label: "Instagram", render: (size: number) => <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#C13584" strokeWidth="2"><circle cx="12" cy="12" r="4.1" /><circle cx="17.6" cy="6.4" r="1.2" fill="#C13584" stroke="none" /><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /></svg> },
  { label: "YouTube", render: (size: number) => <svg viewBox="0 0 24 24" width={size} height={size} fill="#FF0000"><rect x="2.5" y="5.2" width="19" height="13.6" rx="3.2" /><path d="M10 9.2v5.6l4.8-2.8L10 9.2Z" fill="#fff" /></svg> },
  { label: "Growth", render: (size: number) => <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#15803D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 16.5 10 10l3.5 3.5L20 7" /><path d="M14.5 7H20v5.5" /></svg> },
];

/** Round translucent tiles keep the mixed brand marks reading as one set. */
export function SocialCluster({
  iconSize = 28,
  tileSize = 40,
  columns = 4,
  className,
}: {
  iconSize?: number;
  tileSize?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("grid shrink-0", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, ${tileSize}px)`, gap: Math.max(4, Math.round(tileSize * 0.15)) }}
      aria-hidden
    >
      {BRAND_ICONS.map((icon) => (
        <span
          key={icon.label}
          className="grid place-items-center rounded-full bg-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.12)] ring-1 ring-black/5 backdrop-blur-sm"
          style={{ width: tileSize, height: tileSize }}
          title={icon.label}
        >
          {icon.render(iconSize)}
        </span>
      ))}
    </span>
  );
}

const SPARK_POINTS = "0,38 18,33 36,35 54,24 72,28 90,16 108,20 126,9 144,12 160,4";

export function ReachSparkline({ className, gradient = true }: { className?: string; gradient?: boolean }) {
  const rawId = useId();
  const gradientId = `spark-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="0 0 160 44" className={className} fill="none" aria-hidden>
      {gradient && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#15803D" stopOpacity="0.24" />
            <stop offset="1" stopColor="#15803D" stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {gradient && <path d={`M${SPARK_POINTS.replaceAll(" ", " L")} L160,44 L0,44 Z`} fill={`url(#${gradientId})`} />}
      <polyline points={SPARK_POINTS} stroke="#15803D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="tn-spark-line" vectorEffect="non-scaling-stroke" />
      <circle cx="160" cy="4" r="3" fill="#15803D" />
    </svg>
  );
}
