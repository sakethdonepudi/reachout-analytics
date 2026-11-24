"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { partyNeedsWhiteInk } from "@/lib/tamil-nadu/party-brand";

export function PillRow({
  label,
  children,
  ariaLabel,
  className,
}: {
  label: string;
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-2 min-[640px]:flex-row min-[640px]:items-center", className)}>
      <span className="shrink-0 text-[12px] font-bold uppercase tracking-[0.12em] text-[color:var(--theme-warning)]">{label}</span>
      <div className="edge-fade-right no-scrollbar flex w-full min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pb-1 snap-x min-[640px]:w-auto min-[640px]:flex-1" role="group" aria-label={ariaLabel ?? label}>
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
}: {
  selected: boolean;
  colour: string;
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
  const white = party ? partyNeedsWhiteInk(party) : false;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      title={title}
      data-slot-active={dataActive ? "true" : undefined}
      data-profile-tab={profileTab}
      onMouseEnter={onMouseEnter}
      data-pill-party={party}
      data-pill-selected={selected ? "true" : "false"}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11! shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-[14px] font-semibold transition-all active:scale-[0.98]",
        selected ? "shadow-[0_0_0_2px_var(--theme-surface),0_0_0_3.5px_var(--theme-selected)]" : "hover:border-[color:var(--theme-text)]",
        className,
      )}
      style={{
        background: selected ? colour : `color-mix(in srgb, ${colour} 16%, var(--theme-surface))`,
        borderColor: selected ? "var(--theme-selected)" : "var(--theme-border)",
        color: selected ? (white ? "#fff" : "#0B0B0C") : "var(--theme-text)",
      }}
    >
      {children}
      {check && selected && <Check className="size-3.5" aria-hidden />}
    </button>
  );
}
