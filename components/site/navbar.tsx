"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, BarChart3, ChevronDown, LayoutDashboard, LogOut, Menu, Megaphone, ShieldCheck, UserRound, X } from "lucide-react";
import ThemeToggle from "@/components/site/theme-toggle";
import { useSession } from "@/components/site/use-session";
import { cn } from "@/lib/utils";

export function Logo({ className, variant = "auto", linked = true }: { className?: string; variant?: "auto" | "light" | "dark"; linked?: boolean }) {
  const imageClass = "h-full w-full object-contain object-left";
  const light = <img src="/brand/reachout-logo-light.svg" alt="Reachout Analytics" width={1290} height={285} className={imageClass} decoding="async" draggable={false} />;
  const lightForDarkThemes = <img src="/brand/reachout-logo-light.svg" alt="Reachout Analytics" width={1290} height={285} className={cn(imageClass, "dark:hidden")} decoding="async" draggable={false} />;
  const dark = <img src="/brand/reachout-logo-dark.svg" alt="Reachout Analytics" width={1290} height={285} className={imageClass} decoding="async" draggable={false} />;
  const artwork = variant === "dark" ? dark : variant === "light" ? light : <>{lightForDarkThemes}<span className="hidden dark:block">{dark}</span></>;
  const classes = cn("relative block h-[28px] w-[124px] shrink-0 transition-opacity sm:h-[32px] sm:w-[142px]", linked && "hover:opacity-85", className);
  return linked ? (
    <Link href="/#top" aria-label="Reachout Analytics" className={classes}>{artwork}</Link>
  ) : (
    <span className={classes} aria-hidden>{artwork}</span>
  );
}

function HeaderLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45",
        active ? "site-group-inset text-[var(--h-ink)]" : "text-[var(--h-muted)] hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)]",
      )}
    >
      {active && <span className="size-1.5 rounded-full bg-[var(--h-brass)]" aria-hidden />}
      {children}
    </Link>
  );
}

function MenuLink({ href, active, onClick, children }: { href: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-11 items-center gap-2 rounded-xl px-3 text-[14px] font-semibold transition-colors",
        active ? "site-group-inset text-[var(--h-ink)]" : "text-[var(--h-muted)] hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)]",
      )}
    >
      {active && <span className="size-1.5 rounded-full bg-[var(--h-brass)]" aria-hidden />}
      {children}
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { state, authed, role } = useSession();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

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

  async function signOutAll() {
    try {
      await fetch("/api/auth/logout-all", { method: "POST" });
    } finally {
      setAccountOpen(false);
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <header className="site-header pointer-events-none fixed inset-x-0 top-0 z-50 px-0 pt-4 sm:pt-5">
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-3 px-6 sm:px-10 md:grid md:grid-cols-[1fr_auto_1fr]">
        <div className="min-w-0 md:justify-self-start">
          <Link
            href="/#top"
            aria-label="Reachout Analytics — Home"
            className="site-group pointer-events-auto inline-flex h-12 items-center rounded-[15px] px-3.5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45"
          >
            <Logo linked={false} variant="light" className="h-[26px] w-[118px] sm:h-[28px] sm:w-[130px]" />
          </Link>
        </div>

        <nav className="hidden md:block md:justify-self-center" aria-label="Primary">
          <div className="site-group pointer-events-auto inline-flex h-12 items-center rounded-full p-1">
            <HeaderLink href="/#top" active={isHome}>Home</HeaderLink>
            {authed && <HeaderLink href="/case-studies" active={isCaseStudy}>Case Studies</HeaderLink>}
          </div>
        </nav>

        <div className="pointer-events-auto min-w-0 md:justify-self-end">
          <div className="site-group inline-flex h-12 items-center gap-1 rounded-full p-1.5">
            <ThemeToggle bare />
            <span className="mx-0.5 h-5 w-px bg-[var(--h-border)] opacity-25" aria-hidden />

            {showAdmin && (
              <Link
                href="/login"
                className="hidden h-9 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-[var(--h-ink)] transition-colors hover:bg-[var(--h-surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45 md:inline-flex"
              >
                Admin Login <ArrowUpRight className="size-3.5 text-[var(--h-brass)]" aria-hidden />
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
                    "inline-flex h-9 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-[var(--h-ink)] transition-colors hover:bg-[var(--h-surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45",
                    accountOpen && "site-group-inset",
                  )}
                >
                  <UserRound className="size-3.5" aria-hidden /> Account
                  <ChevronDown className={cn("size-3.5 text-[var(--h-muted)] transition-transform", accountOpen && "rotate-180")} aria-hidden />
                </button>
                {accountOpen && (
                  <div role="menu" className="site-group absolute right-0 top-[calc(100%+8px)] w-56 rounded-2xl p-1.5 text-[var(--h-ink)]">
                    {role === "owner" && (
                      <>
                        <Link href="/meta-ads" role="menuitem" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-medium text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45">
                          <Megaphone className="size-3.5" aria-hidden /> Meta Ads
                        </Link>
                        <Link href="/admin" role="menuitem" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-medium text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45">
                          <LayoutDashboard className="size-3.5" aria-hidden /> Dashboard
                        </Link>
                      </>
                    )}
                    {role === "client" && (
                      <Link href="/campaigns" role="menuitem" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-medium text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45">
                        <BarChart3 className="size-3.5" aria-hidden /> Campaigns
                      </Link>
                    )}
                    <Link href={role === "client" ? "/campaigns" : "/case-studies"} role="menuitem" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-medium text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45">
                      <ShieldCheck className="size-3.5" aria-hidden /> {role === "client" ? "Case Studies" : "Workspace"}
                    </Link>
                    <div className="my-1 h-px bg-[var(--h-border)]/20" />
                    <button type="button" role="menuitem" onClick={signOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12.5px] font-medium text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45">
                      <LogOut className="size-3.5" aria-hidden /> Sign Out
                    </button>
                    <button type="button" role="menuitem" onClick={signOutAll} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12.5px] font-medium text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45">
                      <LogOut className="size-3.5" aria-hidden /> Sign out of all devices
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              className="grid size-9 place-items-center rounded-full text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45 md:hidden"
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? "Close menu" : "Open menu"}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="pointer-events-auto mx-auto mt-2 w-full max-w-[1280px] px-6 sm:px-10 md:hidden">
          <div className="site-group rounded-2xl p-2 text-[var(--h-ink)]">
            <MenuLink href="/#top" active={isHome} onClick={() => setOpen(false)}>Home</MenuLink>
            {authed && <MenuLink href="/case-studies" active={isCaseStudy} onClick={() => setOpen(false)}>Case Studies</MenuLink>}
            {showAdmin && (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="mt-1 flex h-11 items-center justify-between rounded-xl px-3 text-[14px] font-semibold text-[var(--h-ink)] transition-colors hover:bg-[var(--h-surface-inset)]"
              >
                Admin Login <ArrowUpRight className="size-4 text-[var(--h-brass)]" aria-hidden />
              </Link>
            )}
            {authed && (
              <div className="mt-1 border-t border-[var(--h-border)]/20 pt-1">
                {role === "owner" && (
                  <>
                    <Link href="/meta-ads" onClick={() => setOpen(false)} className="flex h-11 items-center gap-2 rounded-xl px-3 text-[14px] font-medium text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)]">
                      <Megaphone className="size-4" aria-hidden /> Meta Ads
                    </Link>
                    <Link href="/admin" onClick={() => setOpen(false)} className="flex h-11 items-center gap-2 rounded-xl px-3 text-[14px] font-medium text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)]">
                      <LayoutDashboard className="size-4" aria-hidden /> Dashboard
                    </Link>
                  </>
                )}
                {role === "client" && (
                  <Link href="/campaigns" onClick={() => setOpen(false)} className="flex h-11 items-center gap-2 rounded-xl px-3 text-[14px] font-medium text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)]">
                    <BarChart3 className="size-4" aria-hidden /> Campaigns
                  </Link>
                )}
                <button type="button" onClick={signOut} className="flex h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-[14px] font-medium text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)]">
                  <LogOut className="size-4" aria-hidden /> Sign Out
                </button>
                <button type="button" onClick={signOutAll} className="flex h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-[14px] font-medium text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)]">
                  <LogOut className="size-4" aria-hidden /> Sign out of all devices
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
