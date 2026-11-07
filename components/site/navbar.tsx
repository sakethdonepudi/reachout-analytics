"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, LayoutDashboard, LogOut, Menu, UserRound, X } from "lucide-react";
import ThemeToggle from "@/components/site/theme-toggle";
import { useSession } from "@/components/site/use-session";
import { cn } from "@/lib/utils";

export function Logo({ className, variant = "auto" }: { className?: string; variant?: "auto" | "dark" }) {
  const light = <img src="/brand/reachout-logo-light.svg" alt="Reachout Analytics" width={1290} height={285} className="h-full w-full object-contain object-left dark:hidden" decoding="async" draggable={false} />;
  const dark = <img src="/brand/reachout-logo-dark.svg" alt="Reachout Analytics" width={1290} height={285} className="h-full w-full object-contain object-left" decoding="async" draggable={false} />;
  return (
    <Link href="/#top" aria-label="Reachout Analytics" className={cn("relative block h-[28px] w-[124px] shrink-0 transition-opacity hover:opacity-85 sm:h-[32px] sm:w-[142px]", className)}>
      {variant === "dark" ? dark : <>{light}<span className="hidden dark:block">{dark}</span></>}
    </Link>
  );
}

function MastheadContours() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 68" preserveAspectRatio="none" fill="none" aria-hidden>
      <g stroke="var(--m-contour)" strokeWidth="1">
        <path d="M-40 46C140 18 260 54 420 30S680 6 860 30 1180 52 1480 22" />
        <path d="M-40 28C120 52 250 20 410 38S680 56 860 34 1180 12 1480 40" />
        <path d="M-40 56C150 30 270 62 430 40S690 18 870 42 1190 62 1480 34" />
        <path d="M-40 14C130 38 260 6 420 24S690 44 870 20 1200 2 1480 26" />
      </g>
      <g fill="var(--m-brass)" opacity=".3">
        <circle cx="220" cy="34" r="1.6" />
        <circle cx="470" cy="26" r="1.4" />
        <circle cx="720" cy="38" r="1.6" />
        <circle cx="980" cy="22" r="1.4" />
        <circle cx="1220" cy="40" r="1.6" />
      </g>
    </svg>
  );
}

function MastheadLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      data-masthead-active={active ? "true" : undefined}
      className={cn(
        "relative inline-flex h-9 items-center px-3.5 text-[13px] font-semibold tracking-[0.01em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-brass)]/50",
        active ? "text-[var(--m-ink)]" : "text-[var(--m-muted)] hover:text-[var(--m-ink)]",
      )}
    >
      {active && (
        <span
          className="absolute inset-y-1 left-0 right-0 bg-[var(--m-panel)]"
          style={{ clipPath: "polygon(7px 0,100% 0,calc(100% - 7px) 100%,0 100%)" }}
          aria-hidden
        />
      )}
      <span className="relative z-10">{children}</span>
    </Link>
  );
}

function MobileLink({ href, active, onClick, children }: { href: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-between border-l-2 px-3 py-3 text-[15px] font-semibold transition-colors",
        active ? "border-[var(--m-brass)] bg-[var(--m-panel)] text-[var(--m-ink)]" : "border-transparent text-[var(--m-muted)] hover:text-[var(--m-ink)]",
      )}
    >
      {children}
      {active && <span className="text-[8.5px] font-bold uppercase tracking-[0.16em] text-[var(--m-brass)]">Active</span>}
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { state, authed } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [marker, setMarker] = useState({ left: 0, width: 0, show: false });
  const contentRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setAccountOpen(false);
  }, [pathname, state]);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  useEffect(() => {
    const measure = () => {
      const content = contentRef.current;
      const active = navRef.current?.querySelector<HTMLElement>('[data-masthead-active="true"]');
      if (!content || !active) {
        setMarker((previous) => (previous.show ? { ...previous, show: false } : previous));
        return;
      }
      const contentRect = content.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      const next = { left: activeRect.left - contentRect.left, width: activeRect.width, show: activeRect.width > 0 };
      setMarker((previous) =>
        Math.abs(previous.left - next.left) < 0.5 && Math.abs(previous.width - next.width) < 0.5 && previous.show === next.show
          ? previous
          : next,
      );
    };
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    if (contentRef.current) observer.observe(contentRef.current);
    if (navRef.current) observer.observe(navRef.current);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [pathname, state]);

  const isHome = pathname === "/";
  const isCaseStudy = pathname?.startsWith("/case-studies") ?? false;
  const showAdmin = state !== "auth";

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setAccountOpen(false);
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <header className="masthead pointer-events-none fixed inset-x-0 top-0 z-50">
      <div className={cn("masthead-shell pointer-events-auto relative bg-[var(--m-bg)] text-[var(--m-ink)] transition-[height] duration-300", scrolled ? "h-[56px]" : "h-[68px]")}>
        <MastheadContours />

        <div ref={contentRef} className="relative mx-auto flex h-full max-w-[1280px] items-center px-6 sm:px-10">
          <div className="relative flex h-full items-center pr-10 sm:pr-14">
            <span
              className="pointer-events-none absolute inset-y-0 -left-6 right-0 bg-[var(--m-panel)]"
              style={{ clipPath: "polygon(0 0,100% 0,calc(100% - 18px) 100%,0 100%)" }}
              aria-hidden
            />
            <span className="pointer-events-none absolute right-px top-0 h-full w-px origin-top rotate-[17deg] bg-[var(--m-brass)]/40" aria-hidden />
            <Logo className="relative z-10 h-[28px] w-[124px] sm:h-[32px] sm:w-[142px]" />
          </div>

          <nav ref={navRef} className="hidden items-center gap-1 md:flex" aria-label="Primary">
            <MastheadLink href="/#top" active={isHome}>Home</MastheadLink>
            {authed && <MastheadLink href="/case-studies" active={isCaseStudy}>Case Studies</MastheadLink>}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
            <ThemeToggle bare />
            {showAdmin && (
              <Link
                href="/login"
                className="hidden h-9 items-center gap-1.5 bg-[var(--m-brass-strong)] px-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--m-button-ink)] transition-colors hover:bg-[var(--m-brass)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-brass)]/60 md:inline-flex"
                style={{ clipPath: "polygon(0 0,100% 0,calc(100% - 9px) 100%,0 100%)" }}
              >
                Admin Login <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            )}
            {authed && (
              <div ref={accountRef} className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => setAccountOpen((value) => !value)}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  aria-label="Account menu"
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 px-2 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-brass)]/50",
                    accountOpen ? "text-[var(--m-ink)]" : "text-[var(--m-muted)] hover:text-[var(--m-ink)]",
                  )}
                >
                  <UserRound className="size-3.5" aria-hidden /> Account
                  <ChevronDown className={cn("size-3.5 transition-transform", accountOpen && "rotate-180")} aria-hidden />
                </button>
                {accountOpen && (
                  <div role="menu" className="absolute right-0 top-[calc(100%+10px)] w-48 border border-t-2 border-[var(--m-panel-border)] border-t-[var(--m-brass)]/60 bg-[var(--m-menu-bg)] p-1.5 text-[var(--m-ink)] shadow-[0_24px_50px_-24px_rgba(0,0,0,.55)]">
                    <button type="button" role="menuitem" onClick={signOut} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] font-medium text-[var(--m-muted)] transition-colors hover:text-[var(--m-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-brass)]/50">
                      <LogOut className="size-3.5" aria-hidden /> Sign Out
                    </button>
                    <Link href="/admin" role="menuitem" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 px-3 py-2 text-[12.5px] font-medium text-[var(--m-muted)] transition-colors hover:text-[var(--m-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-brass)]/50">
                      <LayoutDashboard className="size-3.5" aria-hidden /> Dashboard
                    </Link>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              className="grid size-9 place-items-center text-[var(--m-muted)] transition-colors hover:text-[var(--m-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-brass)]/50 md:hidden"
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? "Close menu" : "Open menu"}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>

          <span
            className="masthead-marker pointer-events-none absolute bottom-0 h-[2px] bg-[var(--m-brass-strong)]"
            style={{
              left: marker.left,
              width: marker.width,
              opacity: marker.show ? 1 : 0,
              clipPath: "polygon(3px 0,100% 0,calc(100% - 3px) 100%,0 100%)",
            }}
            aria-hidden
          />
        </div>

        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px overflow-hidden">
          <span className="masthead-rule block h-full w-full bg-[var(--m-line)]" />
        </span>
      </div>

      {open && (
        <div className="masthead-shell pointer-events-auto relative border-t border-[var(--m-line)] bg-[var(--m-menu-bg)] px-6 pb-5 pt-3 text-[var(--m-ink)] shadow-[0_24px_50px_-30px_rgba(0,0,0,.65)] md:hidden">
          <MastheadContours />
          <div className="relative">
            <MobileLink href="/#top" active={isHome} onClick={() => setOpen(false)}>Home</MobileLink>
            {authed && <MobileLink href="/case-studies" active={isCaseStudy} onClick={() => setOpen(false)}>Case Studies</MobileLink>}
            {showAdmin && (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="mt-2 flex h-11 items-center justify-center gap-1.5 bg-[var(--m-brass-strong)] text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--m-button-ink)]"
                style={{ clipPath: "polygon(0 0,100% 0,calc(100% - 10px) 100%,0 100%)" }}
              >
                Admin Login <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            )}
            {authed && (
              <div className="mt-2 border-t border-[var(--m-line)] pt-2">
                <button type="button" onClick={signOut} className="flex w-full items-center gap-2 px-3 py-3 text-left text-[14px] font-medium text-[var(--m-muted)] transition-colors hover:text-[var(--m-ink)]">
                  <LogOut className="size-4" aria-hidden /> Sign Out
                </button>
                <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-3 text-[14px] font-medium text-[var(--m-muted)] transition-colors hover:text-[var(--m-ink)]">
                  <LayoutDashboard className="size-4" aria-hidden /> Dashboard
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
