"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/site/theme";
import { cn } from "@/lib/utils";

export default function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      data-theme-toggle={dark ? "dark" : "light"}
      className={cn(
        "theme-btn inline-flex min-h-11! min-w-11 items-center justify-center gap-2 rounded-full text-[var(--h-muted)] hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45",
        withLabel && "w-full justify-between px-3",
        className,
      )}
    >
      {withLabel && <span className="text-[12px] font-semibold text-[var(--h-ink)]">{dark ? "Light mode" : "Dark mode"}</span>}
      {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  );
}
