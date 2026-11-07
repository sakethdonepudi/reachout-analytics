"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import ThemeToggle from "@/components/site/theme-toggle";
import { useSession } from "@/components/site/use-session";
import { cn } from "@/lib/utils";

const PUBLIC_LINKS = [{ label: "Home", href: "/#top" }];
const AUTH_LINKS = [
  { label: "Home", href: "/#top" },
  { label: "Case Studies", href: "/case-studies" },
];

export function Logo({ className, variant = "auto" }: { className?: string; variant?: "auto" | "dark" }) {
  const light = <img src="/brand/reachout-logo-light.svg" alt="Reachout Analytics" width={1290} height={285} className="h-full w-full object-contain object-left dark:hidden" decoding="async" draggable={false} />;
  const dark = <img src="/brand/reachout-logo-dark.svg" alt="Reachout Analytics" width={1290} height={285} className="h-full w-full object-contain object-left" decoding="async" draggable={false} />;
  return (
    <Link href="/#top" aria-label="Reachout Analytics" className={cn("relative block h-[34px] w-[150px] shrink-0 transition-opacity hover:opacity-85 sm:h-[42px] sm:w-[185px]", className)}>
      {variant === "dark" ? dark : <>{light}<span className="hidden dark:block">{dark}</span></>}
    </Link>
  );
}

export default function Navbar() {
  const router = useRouter();
  const { state, authed, anon } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [state]);

  const links = authed ? AUTH_LINKS : PUBLIC_LINKS;

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div
        className={cn(
          "pointer-events-auto relative flex w-full max-w-6xl items-center justify-between rounded-full border border-border/80 pl-4 pr-2 transition-all duration-500 sm:pl-5",
          "bg-card/75 shadow-[0_20px_60px_-24px_rgba(15,20,30,0.45)] backdrop-blur-2xl backdrop-saturate-150",
          scrolled ? "py-1.5" : "py-2 sm:py-2.5",
        )}
      >
        <span className="tricolor-line pointer-events-none absolute inset-x-10 -bottom-px h-px opacity-60" aria-hidden />
        <Logo className="h-[30px] w-[132px] sm:h-[42px] sm:w-[185px]" />

        <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Primary">
          {state !== "loading" && links.map((l) => (
            <a key={l.label} href={l.href} className="rounded-full px-2.5 py-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground xl:px-4 xl:text-sm">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="size-10 shrink-0" />

          {anon && (
            <Link
              href="/login"
              className="inline-flex items-center rounded-full border border-border px-2.5 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60 sm:px-3.5 sm:text-[13px]"
            >
              Admin Login
            </Link>
          )}

          {authed && (
            <>
              <Link
                href="/admin"
                className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60 xl:inline-flex xl:px-3.5 xl:text-[13px]"
              >
                <LayoutDashboard className="size-3.5" aria-hidden /> Dashboard
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="hidden items-center gap-1.5 rounded-full px-2.5 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60 xl:inline-flex"
              >
                <LogOut className="size-3.5" aria-hidden /> Sign out
              </button>
              <button
                className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-elevated hover:text-foreground xl:hidden"
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? "Close menu" : "Open menu"}
              >
                {open ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </>
          )}

        </div>

        {open && state !== "loading" && (
          <div className="glass absolute inset-x-0 top-[calc(100%+10px)] rounded-3xl p-3 xl:hidden">
            {links.map((l) => (
              <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 text-[15px] font-medium text-foreground/85 hover:bg-elevated">
                {l.label}
              </a>
            ))}
            {authed && (
              <>
                <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-medium text-foreground/85 hover:bg-elevated">
                  <LayoutDashboard className="size-4" aria-hidden /> Dashboard
                </Link>
                <button type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left text-[15px] font-medium text-foreground/85 hover:bg-elevated">
                  <LogOut className="size-4" aria-hidden /> Sign out
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
