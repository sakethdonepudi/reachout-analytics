"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export default function ThemeToggle({ className, bare = false }: { className?: string; bare?: boolean }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={dark}
      title={dark ? "Light mode" : "Dark mode"}
      className={cn(
        "grid place-items-center transition-colors focus-visible:outline-none focus-visible:ring-2",
        bare
          ? "size-9 rounded-md border-0 bg-transparent text-[var(--m-muted)] hover:bg-[var(--m-panel)] hover:text-[var(--m-ink)] focus-visible:ring-[var(--m-brass)]/50"
          : "size-10 rounded-full border border-border bg-card/70 text-foreground/80 backdrop-blur-xl hover:text-foreground focus-visible:ring-saffron/60",
        className,
      )}
    >
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
