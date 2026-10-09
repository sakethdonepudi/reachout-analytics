"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import ShimmerButton from "@/components/ui/shimmer-button";
import ThemeToggle from "@/components/site/theme-toggle";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Home", href: "/#top" },
  { label: "Services", href: "https://www.reachoutanalytics.com/services/" },
  { label: "Case Studies", href: "/case-studies" },
  { label: "About Us", href: "https://www.reachoutanalytics.com/about/" },
  { label: "Contact", href: "/#contact" },
];

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/#top" className={cn("flex items-center gap-2.5 font-display text-[17px] font-semibold tracking-tight text-foreground", className)}>
      <span className="grid gap-[3px]" aria-hidden>
        <b className="block h-[3px] w-5 -skew-x-[20deg] rounded-full bg-saffron" />
        <b className="block h-[3px] w-4 -skew-x-[20deg] rounded-full bg-foreground" />
        <b className="block h-[3px] w-3 -skew-x-[20deg] rounded-full bg-[#2fbf4a]" />
      </span>
      <span>
        Reach<span className="text-saffron">Out</span> Analytics
      </span>
    </Link>
  );
}

export default function Navbar() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <div
        className={cn(
          "pointer-events-auto relative flex w-full max-w-6xl items-center justify-between rounded-full border border-border/80 pl-5 pr-2 transition-all duration-500",
          "bg-card/75 shadow-[0_20px_60px_-24px_rgba(15,20,30,0.45)] backdrop-blur-2xl backdrop-saturate-150",
          scrolled ? "py-1.5" : "py-2.5",
        )}
      >
        <span className="tricolor-line pointer-events-none absolute inset-x-10 -bottom-px h-px opacity-60" aria-hidden />
        <Logo />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ShimmerButton
            text="Book a Consultation"
            duration={2}
            onClick={() => router.push("/#contact")}
            className="hidden border-border px-5 py-2 sm:block"
          />
          <ThemeToggle className="size-10 shrink-0" />
          <button
            className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-elevated hover:text-foreground md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {open && (
          <div className="glass absolute inset-x-0 top-[calc(100%+10px)] rounded-3xl p-3 md:hidden">
            {LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-2xl px-4 py-3 text-[15px] font-medium text-foreground/85 hover:bg-elevated"
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
