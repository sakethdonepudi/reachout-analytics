"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

const BRAND_ICONS = [
  { label: "Facebook", render: (size: number) => <svg viewBox="0 0 24 24" width={size} height={size} fill="#1877F2"><path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.7V4.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.4V14h2.7v8h3.4Z" /></svg> },
  { label: "Instagram", render: (size: number) => <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#C13584" strokeWidth="2"><circle cx="12" cy="12" r="4.1" /><circle cx="17.6" cy="6.4" r="1.2" fill="#C13584" stroke="none" /><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /></svg> },
];

/** Round translucent tiles keep the mixed brand marks reading as one set. */
export function SocialCluster({
  iconSize = 28,
  tileSize = 40,
  columns = 2,
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
          className="social-tile grid place-items-center rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.12)] ring-1 ring-black/5 backdrop-blur-sm"
          style={{ width: tileSize, height: tileSize }}
          title={icon.label}
        >
          {icon.render(iconSize)}
        </span>
      ))}
    </span>
  );
}
