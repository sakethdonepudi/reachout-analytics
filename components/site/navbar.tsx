"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutDashboard, LogOut, Menu, UserRound, X } from "lucide-react";
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

const linkClass = (active: boolean) =>
  cn(
    "rounded-full px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60",
    active ? "bg-elevated text-foreground" : "text-muted-foreground hover:bg-elevated/70 hover:text-foreground",
  );

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { state, authed, anon } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
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

  const isHome = pathname === "/";
  const isCaseStudy = pathname?.startsWith("/case-studies") ?? false;

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
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-6">
      <div
        className={cn(
          "pointer-events-auto relative flex w-full max-w-[1280px] items-center justify-between rounded-full border border-border/80 bg-card/80 pl-4 pr-2 shadow-[0_14px_40px_-28px_rgba(15,20,30,0.5)] backdrop-blur-2xl backdrop-saturate-150 transition-all duration-500 sm:pl-10 sm:pr-8",
          scrolled ? "py-1.5" : "py-2",
        )}
      >
        <Logo />

        <div className="flex items-center gap-1.5 sm:gap-2">
          {state !== "loading" && (
            <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary">
              <Link href="/#top" className={linkClass(isHome)} aria-current={isHome ? "page" : undefined}>Home</Link>
              {authed && (
                <Link href="/case-studies" className={linkClass(isCaseStudy)} aria-current={isCaseStudy ? "page" : undefined}>
                  Case Studies
                </Link>
              )}
            </nav>
          )}

          <ThemeToggle className="size-9 shrink-0" />

          {anon && (
            <Link
              href="/login"
              className="hidden items-center rounded-full border border-border bg-card px-3.5 py-1.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60 md:inline-flex"
            >
              Admin Login
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
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60"
              >
                <UserRound className="size-3.5" aria-hidden />
                <span>Account</span>
                <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", accountOpen && "rotate-180")} aria-hidden />
              </button>
              {accountOpen && (
                <div role="menu" className="absolute right-0 top-[calc(100%+8px)] w-44 rounded-2xl border border-border bg-card p-1.5 shadow-[0_20px_50px_-24px_rgba(15,20,30,.5)]">
                  <button type="button" role="menuitem" onClick={signOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
                    <LogOut className="size-3.5" aria-hidden /> Sign Out
                  </button>
                  <Link href="/admin" role="menuitem" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
                    <LayoutDashboard className="size-3.5" aria-hidden /> Dashboard
                  </Link>
                </div>
              )}
            </div>
          )}

          {state !== "loading" && (
            <button
              className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground md:hidden"
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? "Close menu" : "Open menu"}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          )}
        </div>

        {open && state !== "loading" && (
          <div className="glass absolute inset-x-0 top-[calc(100%+10px)] rounded-3xl p-3 md:hidden">
            <Link href="/#top" onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 text-[15px] font-medium text-foreground/85 hover:bg-elevated">
              Home
            </Link>
            {authed && (
              <Link href="/case-studies" onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 text-[15px] font-medium text-foreground/85 hover:bg-elevated">
                Case Studies
              </Link>
            )}
            {anon && (
              <Link href="/login" onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 text-[15px] font-medium text-foreground/85 hover:bg-elevated">
                Admin Login
              </Link>
            )}
            {authed && (
              <>
                <button type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left text-[15px] font-medium text-foreground/85 hover:bg-elevated">
                  <LogOut className="size-4" aria-hidden /> Sign Out
                </button>
                <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-medium text-foreground/85 hover:bg-elevated">
                  <LayoutDashboard className="size-4" aria-hidden /> Dashboard
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
