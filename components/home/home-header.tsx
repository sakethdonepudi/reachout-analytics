"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Menu } from "lucide-react";
import { Logo } from "@/components/site/brand";
import { Sheet } from "@/components/ui/sheet";
import { useIdle } from "@/components/auth/idle-provider";
import { announceOpening } from "@/lib/use-navigate";
import { NavIcon, NavPartyMark } from "@/components/site/nav-icon";
import { useSlidingUnderline } from "@/components/ui/use-sliding-underline";
import { ACCOUNT_ITEMS, ADMIN_LOGIN, CLIENT_NAV, PUBLIC_NAV, type NavItem } from "@/lib/nav";
import type { PartyId } from "@/lib/parties";

export type HomeCase = { slug: string; party: PartyId; stateName: string };

function idleLabel(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const linkClass = "inline-flex shrink-0 whitespace-nowrap min-h-10 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-[#555] transition-colors hover:bg-[#F5F5F5] hover:text-[#0B0B0C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B0B0C] max-[1100px]:px-2 max-[1100px]:text-[12.5px]";

export default function HomeHeader({
  role,
  displayName,
  cases,
}: {
  role: "anon" | "client";
  displayName?: string | null;
  cases: HomeCase[];
}) {
  const pathname = usePathname();
  const { remainingMs } = useIdle();
  const [casesOpen, setCasesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const casesRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const items = role === "client" ? CLIENT_NAV : PUBLIC_NAV;
  const underline = useSlidingUnderline(navRef, pathname ?? "");

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (casesRef.current && !casesRef.current.contains(event.target as Node)) setCasesOpen(false);
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setCasesOpen(false); setAccountOpen(false); }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); };
  }, []);

  async function signOut() {
    const started = performance.now();
    announceOpening("Signing out", true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    const remaining = 320 - (performance.now() - started);
    if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
    window.location.assign("/login");
  }

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/case-studies") return Boolean(pathname?.startsWith("/case-studies"));
    if (href === "/services") return pathname === "/services";
    if (href === "/services/research-content") return pathname === "/services/research-content";
    if (href === "/about") return pathname === "/about";
    return pathname === href;
  };

  const grouped = cases.reduce<Record<string, HomeCase[]>>((acc, item) => {
    (acc[item.stateName] ??= []).push(item);
    return acc;
  }, {});

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[var(--z-nav)] h-16 border-b border-[#E6E6E6] bg-white">
        <div className="mx-auto flex h-full max-w-[1440px] items-center gap-4 px-5 sm:px-8 lg:px-16">
          <Logo variant="light" className="h-8 w-[124px] shrink-0" />

          <nav ref={navRef} className="relative ml-2 hidden items-center gap-0.5 min-[900px]:flex" aria-label="Primary">
            {items.map((item) => {
              if (role === "client" && item.key === "cases") {
                return (
                  <div key="cases" ref={casesRef} className="relative">
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={casesOpen}
                      data-tab-active={isActive("/case-studies") || undefined}
                      onClick={() => setCasesOpen((value) => !value)}
                      className={linkClass}
                    >
                      <NavIcon name="casesOpen" /> Case Studies <ChevronDown className={casesOpen ? "size-3 rotate-180 transition-transform duration-150" : "size-3 transition-transform duration-150"} aria-hidden />
                    </button>
                    <div role="menu" data-open={casesOpen} aria-hidden={!casesOpen} className="home-menu absolute left-0 top-[calc(100%+8px)] z-[var(--z-dropdown)] max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-[#E6E6E6] bg-white p-2 shadow-[0_10px_30px_rgba(0,0,0,.08)]">
                      {Object.entries(grouped).map(([state, rows]) => (
                        <div key={state} className="mb-1 last:mb-0">
                          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8A8A]">{state}</p>
                          {rows.map((row) => (
                            <Link key={row.slug} href={`/case-studies/${row.slug}`} role="menuitem" onClick={() => setCasesOpen(false)} className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-[#0B0B0C] hover:bg-[#F5F5F5]">
                              <NavPartyMark party={row.party} />
                              <span>{row.stateName} · {row.party}</span>
                            </Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return <HomeNavLink key={item.key} item={item} active={isActive(item.href)} className={linkClass} />;
            })}
            {underline && <span className="nav-underline" style={{ transform: `translateX(${underline.left}px)`, width: underline.width }} aria-hidden />}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            {role === "anon" ? (
              <a href={ADMIN_LOGIN.href} className="hidden min-h-10 items-center gap-1.5 rounded-[10px] border border-[#0B0B0C] px-4 text-[13px] font-semibold text-[#0B0B0C] transition-colors hover:bg-[#0B0B0C] hover:text-white min-[900px]:inline-flex">
                <NavIcon name="login" /> Admin Login
              </a>
            ) : (
              <div ref={accountRef} className="relative hidden min-[900px]:block">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  onClick={() => setAccountOpen((value) => !value)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-[13px] font-medium text-[#0B0B0C] hover:bg-[#F5F5F5]"
                >
                  <span className="sr-only">Account menu</span>
                  <span className="grid size-7 place-items-center rounded-full bg-[#0B0B0C] text-[10px] font-bold text-white">{(displayName ?? "You").split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span>
                  <span className="max-w-[110px] truncate">{displayName ?? "Account"}</span>
                  <span className="text-[9.5px] tabular-nums text-[#8A8A8A]">{idleLabel(remainingMs)}</span>
                </button>
                <div role="menu" data-open={accountOpen} aria-hidden={!accountOpen} className="home-menu absolute right-0 top-[calc(100%+8px)] z-[var(--z-dropdown)] w-60 rounded-xl border border-[#E6E6E6] bg-white p-2 shadow-[0_10px_30px_rgba(0,0,0,.08)]">
                  <p className="px-2 pb-1 text-[11px] text-[#6B6B6B]">Signs out in {idleLabel(remainingMs)}</p>
                  {[ACCOUNT_ITEMS.security, ACCOUNT_ITEMS.sessions, ACCOUNT_ITEMS.password].map((item) => (
                    <Link key={item.key} href={item.href} role="menuitem" onClick={() => setAccountOpen(false)} className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-[#0B0B0C] hover:bg-[#F5F5F5]">
                      <NavIcon name={item.icon} /> {item.label}
                    </Link>
                  ))}
                  <button type="button" role="menuitem" onClick={() => void signOut()} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-[#0B0B0C] hover:bg-[#F5F5F5]">
                    <LogOut className="size-4" /> Sign out
                  </button>
                </div>
              </div>
            )}

            <button type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)} className="grid size-11 place-items-center rounded-md text-[#0B0B0C] hover:bg-[#F5F5F5] min-[900px]:hidden">
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
        <div className="space-y-1">
          {role === "client" ? (
            <>
              <MobileLink item={CLIENT_NAV[0]} />
              <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8A8A]">Case Studies</p>
              {cases.map((row) => (
                <Link key={row.slug} href={`/case-studies/${row.slug}`} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-[14px] font-medium text-[#0B0B0C]">
                  <NavPartyMark party={row.party} />
                  <span>{row.stateName} · {row.party}</span>
                </Link>
              ))}
              {CLIENT_NAV.slice(2).map((item) => <MobileLink key={item.key} item={item} />)}
              <div className="my-1 h-px bg-[#E6E6E6]" />
              {[ACCOUNT_ITEMS.security, ACCOUNT_ITEMS.sessions, ACCOUNT_ITEMS.password].map((item) => <MobileLink key={item.key} item={item} />)}
              <p className="px-3 pt-2 text-[11px] text-[#6B6B6B]">Signs out in {idleLabel(remainingMs)}</p>
              <button type="button" onClick={() => void signOut()} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-[14px] font-medium text-[#0B0B0C]">
                <LogOut className="size-4" /> Sign out
              </button>
            </>
          ) : (
            <>
              {PUBLIC_NAV.map((item) => <MobileLink key={item.key} item={item} />)}
              <a href={ADMIN_LOGIN.href} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-[14px] font-semibold text-[#0B0B0C]">
                <NavIcon name="login" /> Admin Login
              </a>
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}

function HomeNavLink({ item, active, className }: { item: NavItem; active: boolean; className: string }) {
  return (
    <Link href={item.href} data-tab-active={active || undefined} aria-current={active ? "page" : undefined} className={`${className} ${active ? "text-[#0B0B0C]" : ""}`}>
      <NavIcon name={item.icon} />
      <span>{item.label}</span>
    </Link>
  );
}

function MobileLink({ item }: { item: NavItem }) {
  return (
    <Link href={item.href} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-[14px] font-semibold text-[#0B0B0C]">
      <NavIcon name={item.icon} /> {item.label}
    </Link>
  );
}
