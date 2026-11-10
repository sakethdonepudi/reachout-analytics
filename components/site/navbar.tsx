"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutDashboard, LogOut, Menu, Megaphone, Settings, UserRound } from "lucide-react";
import ThemeToggle from "@/components/site/theme-toggle";
import { useSession } from "@/components/site/use-session";
import { Sheet } from "@/components/ui/sheet";
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
        "relative flex min-h-11 items-center gap-2 rounded-xl px-3 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brass)]",
        active ? "bg-[var(--surface-raised)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]",
      )}
    >
      {active && <span className="size-1.5 rounded-[2px] bg-[var(--accent-brass)]" aria-hidden />}
      {children}
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { state, authed, role } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname, state]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
  const isMeta = pathname?.startsWith("/meta-ads") ?? false;
  const roleLabel = role === "owner" ? "Owner" : "Client";

  async function signOut(all = false) {
    try {
      await fetch(all ? "/api/auth/logout-all" : "/api/auth/logout", { method: "POST" });
    } finally {
      setAccountOpen(false);
      setMenuOpen(false);
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <>
      <header className={cn("site-header pointer-events-none fixed inset-x-0 top-0 z-50 px-0 transition-[padding] duration-200", scrolled ? "pt-2 backdrop-blur-sm sm:pt-3" : "pt-4 sm:pt-5")}>
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-3 px-6 sm:px-10 md:grid md:grid-cols-[1fr_auto_1fr]">
          <div className="min-w-0 md:justify-self-start">
            <Link
              href="/#top"
              aria-label="Reachout Analytics — Home"
              className="site-group pointer-events-auto inline-flex h-11 items-center rounded-[15px] px-3.5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45 sm:h-12"
            >
              <Logo linked={false} variant="light" className="h-[26px] w-[118px] sm:h-[28px] sm:w-[130px]" />
            </Link>
          </div>

          <nav className="hidden md:block md:justify-self-center" aria-label="Primary">
            <div className="site-group pointer-events-auto inline-flex h-11 items-center rounded-full p-1 sm:h-12">
              <HeaderLink href="/#top" active={isHome}>Home</HeaderLink>
              {authed && <HeaderLink href="/case-studies" active={isCaseStudy}>Case Studies</HeaderLink>}
              {role === "owner" && <HeaderLink href="/meta-ads" active={isMeta}>Meta Ads</HeaderLink>}
            </div>
          </nav>

          <div className="pointer-events-auto min-w-0 md:justify-self-end">
            <div className="site-group inline-flex h-11 items-center gap-1 rounded-full p-1.5 sm:h-12">
              <ThemeToggle bare />
              <span className="mx-0.5 h-5 w-px bg-[var(--h-border)] opacity-25" aria-hidden />

              {!authed && (
                <Link
                  href="/login"
                  className="hidden h-9 items-center rounded-full px-3 text-[12px] font-semibold text-[var(--h-ink)] transition-colors hover:bg-[var(--h-surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45 md:inline-flex"
                >
                  Login
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
                    <div role="menu" className="site-group absolute right-0 top-[calc(100%+8px)] w-60 rounded-2xl p-1.5 text-[var(--h-ink)]">
                      <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--h-muted)]">{roleLabel}</p>
                      {role === "owner" && (
                        <Link href="/meta-ads/settings" role="menuitem" onClick={() => setAccountOpen(false)} className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-[12.5px] font-medium text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45">
                          <Settings className="size-3.5" aria-hidden /> Meta settings
                        </Link>
                      )}
                      <button type="button" role="menuitem" onClick={() => void signOut(false)} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-[12.5px] font-medium text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45">
                        <LogOut className="size-3.5" aria-hidden /> Sign out
                      </button>
                      <button type="button" role="menuitem" onClick={() => void signOut(true)} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-[12.5px] font-medium text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45">
                        <LogOut className="size-3.5" aria-hidden /> Sign out of all devices
                      </button>
                      {role === "owner" && (
                        <>
                          <div className="my-1 h-px bg-[var(--h-border)]/20" />
                          <Link href="/admin" role="menuitem" onClick={() => setAccountOpen(false)} className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-[12.5px] font-medium text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45">
                            <LayoutDashboard className="size-3.5" aria-hidden /> Dashboard
                          </Link>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                className="grid size-10 place-items-center rounded-full text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45 md:hidden"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="size-5" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </header>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
        <div className="space-y-1">
          <MenuLink href="/#top" active={isHome} onClick={() => setMenuOpen(false)}>Home</MenuLink>
          {authed && <MenuLink href="/case-studies" active={isCaseStudy} onClick={() => setMenuOpen(false)}>Case Studies</MenuLink>}
          {role === "owner" && <MenuLink href="/meta-ads" active={isMeta} onClick={() => setMenuOpen(false)}><Megaphone className="size-4" aria-hidden /> Meta Ads</MenuLink>}
          {!authed && (
            <MenuLink href="/login" active={false} onClick={() => setMenuOpen(false)}>Login</MenuLink>
          )}
          {authed && (
            <>
              <p className="px-3 pt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">{roleLabel}</p>
              {role === "owner" && (
                <MenuLink href="/meta-ads/settings" active={false} onClick={() => setMenuOpen(false)}><Settings className="size-4" aria-hidden /> Meta settings</MenuLink>
              )}
              <button type="button" onClick={() => void signOut(false)} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-[14px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]">
                <LogOut className="size-4" aria-hidden /> Sign out
              </button>
              <button type="button" onClick={() => void signOut(true)} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-[14px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]">
                <LogOut className="size-4" aria-hidden /> Sign out of all devices
              </button>
              {role === "owner" && (
                <MenuLink href="/admin" active={false} onClick={() => setMenuOpen(false)}><LayoutDashboard className="size-4" aria-hidden /> Dashboard</MenuLink>
              )}
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}
