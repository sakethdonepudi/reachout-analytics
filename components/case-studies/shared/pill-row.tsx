"use client";

import { Check } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PillRow({
  label,
  children,
  ariaLabel,
  className,
  wrap = false,
}: {
  label: string;
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
  wrap?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-2 min-[640px]:flex-row", wrap ? "min-[640px]:items-start" : "min-[640px]:items-center", className)}>
      <span className="shrink-0 text-[12px] font-bold uppercase tracking-[0.12em] text-[color:var(--theme-warning)]">{label}</span>
      <div className={cn("no-scrollbar flex w-full min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 snap-x", wrap ? "min-[640px]:flex-wrap min-[640px]:overflow-visible" : "edge-fade-right min-[640px]:w-auto min-[640px]:flex-1")} role="group" aria-label={ariaLabel ?? label}>
        {children}
      </div>
    </div>
  );
}

export function Pill({
  selected,
  colour,
  children,
  onClick,
  label,
  title,
  check = false,
  className,
  dataActive,
  party,
  profileTab,
  onMouseEnter,
  variant = "party",
}: {
  selected: boolean;
  colour?: string;
  variant?: "party" | "profile" | "subround" | "all";
  children: ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  label?: string;
  title?: string;
  check?: boolean;
  className?: string;
  dataActive?: boolean;
  party?: string;
  profileTab?: string;
  onMouseEnter?: () => void;
}) {
  const style = { "--chip-color": colour ?? "var(--theme-text)" } as CSSProperties;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      title={title}
      data-profile-tab={profileTab}
      onMouseEnter={onMouseEnter}
      data-pill-party={party}
      data-pill-selected={selected ? "true" : "false"}
      data-selected={selected ? "true" : "false"}
      data-variant={variant}
      onClick={onClick}
      className={cn(
        "case-chip inline-flex h-8 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[12px] font-semibold leading-none transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--theme-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--theme-surface)]",
        className,
      )}
      style={style}
    >
      {children}
      {check && selected && <Check className="size-3.5" aria-hidden />}
    </button>
  );
}
