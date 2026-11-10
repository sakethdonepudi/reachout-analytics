"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function label(timestamp: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} h ago`;
  return `Updated ${Math.floor(hours / 24)} d ago`;
}

export function UpdatedAt({ at, className }: { at: string | Date | null | undefined; className?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!at) return <span className={cn("text-[11px] text-[var(--text-muted)]", className)}>Not updated yet</span>;
  const timestamp = typeof at === "string" ? new Date(at).getTime() : at.getTime();
  if (!Number.isFinite(timestamp)) return <span className={cn("text-[11px] text-[var(--text-muted)]", className)}>—</span>;
  return (
    <span suppressHydrationWarning className={cn("text-[11px] text-[var(--text-muted)]", className)}>
      {now == null ? "Updated recently" : label(timestamp, now)}
    </span>
  );
}
