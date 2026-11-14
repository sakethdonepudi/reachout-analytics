"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { Logo } from "@/components/site/brand";
import { Sheet } from "@/components/ui/sheet";
import { useIdle } from "@/components/auth/idle-provider";
import { cn } from "@/lib/utils";
import { announceOpening } from "@/lib/use-navigate";
import { NavIcon, NavPartyMark } from "@/components/site/nav-icon";
import { ACCOUNT_ITEMS, ADMIN_LOGIN, CASE_DASHBOARD, CLIENT_NAV, OWNER_NAV, PUBLIC_NAV, type NavItem } from "@/lib/nav";
import type { PartyId } from "@/lib/parties";

type CaseItem = { slug: string; title: string; state: string; party: PartyId; year: number; draft: boolean };

export type NavCoreProps = {
  variant: "public" | "client" | "owner";
  displayName?: string | null;
  username?: string | null;
  organisation?: string | null;
  signInAt?: string | null;
  lastLoginAt?: string | null;
  lastLoginDevice?: string | null;
  cases?: CaseItem[];
};

const glass = "nav-glass pointer-events-auto";

function idleLabel(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
const linkClass = "inline-flex shrink-0 whitespace-nowrap min-h-10 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45 max-[1100px]:px-2 max-[1100px]:text-[12px]";

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function timeLeft(expiresAt: string | null): string {
  if (!expiresAt) return "—";
  const minutes = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60_000));
  const days = Math.floor(minutes / 1440);
  if (days > 0) return `${days}d`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function Dropdown({ label, items, footer, active, align = "left" }: {
  label: React.ReactNode;
  items: { href: string; label: string; hint?: string; icon?: React.ReactNode; party?: PartyId; active?: boolean }[];
  footer?: { href: string; label: string; icon?: React.ReactNode };
  active?: boolean;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); };
  }, []);

  const hoverOpen = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    timer.current = window.setTimeout(() => setOpen(true), 150);
  };
  const hoverClose = () => {
    if (timer.current) window.clearTimeout(timer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  };

  return (
    <div ref={root} className="relative" onMouseEnter={hoverOpen} onMouseLeave={hoverClose}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} data-nav-active={active || undefined} aria-current={active ? "true" : undefined} onClick={() => setOpen((value) => !value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen((value) => !value); } }} className={cn(linkClass, "gap-1", (active || open) && "site-group-inset text-[var(--h-ink)]")}>
        {label}<ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <div role="menu" aria-hidden={!open} data-open={open} data-align={align} className={cn("nav-menu site-group absolute top-[calc(100%+8px)] z-50 w-64 rounded-2xl p-1.5 text-[var(--h-ink)]", align === "right" ? "right-0" : "left-0")}>
          {items.map((item) => (
            <Link key={item.href + item.label} href={item.href} role="menuitem" onClick={() => setOpen(false)} className={cn("flex min-h-10 items-start gap-2 rounded-xl px-3 py-2 text-[12.5px] font-medium transition-colors hover:bg-[var(--h-surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45", item.active && "site-group-inset")}>
              {item.party ? <NavPartyMark party={item.party} /> : item.icon}
              <span className="min-w-0"><span className="block">{item.label}</span>{item.hint && <span className="mt-0.5 block text-[10px] font-normal text-[var(--h-muted)]">{item.hint}</span>}</span>
            </Link>
          ))}
          {footer && <><div className="my-1 h-px bg-[var(--h-border)]/20" /><Link href={footer.href} role="menuitem" onClick={() => setOpen(false)} className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-[11.5px] font-semibold text-[var(--h-muted)] hover:bg-[var(--h-surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45">{footer.icon}{footer.label}</Link></>}
      </div>
    </div>
  );
}

export default function NavCore({ variant, displayName, username, organisation, signInAt, lastLoginAt, lastLoginDevice, cases = [] }: NavCoreProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { remainingMs } = useIdle();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [underline, setUnderline] = useState<{ left: number; width: number } | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const home = variant === "owner" ? "/dashboard" : "/";

  useEffect(() => { setMenuOpen(false); setAccountOpen(false); }, [pathname]);
  useEffect(() => {
    if (!accountOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setAccountOpen(false); };
    const onPointer = (event: MouseEvent) => { if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onPointer); };
  }, [accountOpen]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const active = nav.querySelector<HTMLElement>('[data-nav-active="true"]');
      if (!active) { setUnderline(null); return; }
      setUnderline({ left: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [pathname, variant]);

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/services") return pathname === "/services";
    if (href === "/services/research-content") return pathname === "/services/research-content";
    if (href === "/case-studies") return Boolean(pathname?.startsWith("/case-studies"));
    if (href === "/about") return pathname === "/about";
    return pathname === href;
  }

  async function signOut() {
    const started = performance.now();
    announceOpening("Signing out", true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    // Keep the loader up long enough to read before the full reload.
    const remaining = 320 - (performance.now() - started);
    if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
    window.location.assign("/login");
  }

  const caseItems = cases.map((row) => ({
    href: `/case-studies/${row.slug}`,
    label: `${row.state} · ${row.party}`,
    hint: `${row.year}${row.draft ? " · Draft" : ""}`,
    party: row.party,
  }));


  return (
    <>
      <header className="site-header pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-2 sm:px-4">
        <div className={cn("site-group pointer-events-auto mx-auto flex h-[52px] w-full max-w-[1240px] items-center gap-2 rounded-full px-3 sm:h-[56px] sm:px-4", glass)}>
          <Logo href={home} className="h-[26px] w-[116px] sm:h-[28px] sm:w-[126px]" />
          <nav ref={navRef} className="relative ml-2 hidden items-center gap-0.5 min-[900px]:flex" aria-label="Primary">
            {variant === "public" && PUBLIC_NAV.map((item) => <NavLink key={item.key} item={item} active={isActive(item.href)} />)}
            {variant === "client" && CLIENT_NAV.map((item) => {
              if (item.key === "cases" && caseItems.length !== 1) {
                return <Dropdown key="cases" label={<><NavIcon name="casesOpen" /> Case Studies</>} items={caseItems} active={Boolean(pathname?.startsWith("/case-studies"))} />;
              }
              if (item.key === "cases" && caseItems.length === 1) {
                return <NavLink key="cases" item={{ ...item, href: caseItems[0].href }} active={Boolean(pathname?.startsWith("/case-studies"))} />;
              }
              return <NavLink key={item.key} item={item} active={isActive(item.href)} />;
            })}
            {variant === "owner" && OWNER_NAV.map((item) => item.key === "cases"
              ? <Dropdown key="cases" label={<><NavIcon name="casesOpen" /> Case Studies</>} items={caseItems} footer={{ ...CASE_DASHBOARD, icon: <NavIcon name="database" /> }} active={Boolean(pathname?.startsWith("/case-studies")) || pathname === "/dashboard/case-studies"} />
              : <NavLink key={item.key} item={item} active={isActive(item.href)} />)}
            {underline && <span className="nav-underline" style={{ transform: `translateX(${underline.left}px)`, width: underline.width }} aria-hidden />}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            {variant === "public" ? (
              <a href="/login" className="hit-expand hidden min-h-10 items-center gap-1.5 rounded-full border border-[#0B0B0C] px-4 text-[12px] font-semibold text-[#0B0B0C] transition-colors hover:bg-[#0B0B0C] hover:text-white min-[900px]:inline-flex"><NavIcon name="login" /> Admin Login</a>
            ) : (
              <>
                <div ref={accountRef} className="relative hidden min-[900px]:block">
                  <button type="button" onClick={() => setAccountOpen((value) => !value)} aria-haspopup="menu" aria-expanded={accountOpen} className={cn("inline-flex min-h-10 items-center gap-2 rounded-full px-2 text-[12px] font-semibold text-[var(--h-ink)] hover:bg-[var(--h-surface-inset)]", accountOpen && "site-group-inset")}>
                    <span className="sr-only">Account menu</span>
                    <span className="grid size-7 place-items-center rounded-full bg-[#0B0B0C] text-[10px] font-bold text-white">{initials(displayName ?? "User")}</span>
                    <span className="hidden max-w-[110px] truncate lg:block">{variant === "client" ? displayName : "Account"}</span>
                    <span className="hidden text-[9.5px] font-normal tabular-nums text-[var(--h-muted)] xl:inline">{idleLabel(remainingMs)}</span>
                    <ChevronDown className="size-3 text-[var(--h-muted)]" />
                  </button>
                  {accountOpen && (
                    <div role="menu" className="site-group absolute right-0 top-[calc(100%+8px)] w-72 rounded-2xl p-2 text-[var(--h-ink)]">
                      {variant === "client" ? (
                        <div className="px-2 pb-2 pt-1 text-[11px] text-[var(--h-muted)]">
                          <p className="text-[13px] font-semibold text-[var(--h-ink)]">{displayName}</p>
                          <p>{organisation ?? "Client"}</p>
                          <p>@{username}</p>
                          <p className="mt-1">Signed in {signInAt ?? "—"}</p>
                          <p>Last sign-in {lastLoginAt ?? "—"}{lastLoginDevice ? ` · ${lastLoginDevice}` : ""}</p>
                          <p className="tabular-nums">Signs out in {idleLabel(remainingMs)}</p>
                        </div>
                      ) : (
                        <div className="px-2 pb-2 pt-1 text-[11px] text-[var(--h-muted)]">
                          <p className="text-[13px] font-semibold text-[var(--h-ink)]">{displayName}</p>
                          <p>Last sign-in {lastLoginAt ?? "—"}{lastLoginDevice ? ` · ${lastLoginDevice}` : ""}</p>
                          <p className="tabular-nums">Signs out in {idleLabel(remainingMs)}</p>
                        </div>
                      )}
                      {variant === "owner" && (
                        <>
                          <MenuLink item={ACCOUNT_ITEMS.users} />
                          <MenuLink item={ACCOUNT_ITEMS.sessions} />
                          <MenuLink item={ACCOUNT_ITEMS.security} />
                        </>
                      )}
                      {variant === "client" && (
                        <>
                          <MenuLink item={ACCOUNT_ITEMS.security} />
                          <MenuLink item={ACCOUNT_ITEMS.sessions} />
                          <MenuLink item={ACCOUNT_ITEMS.password} />
                        </>
                      )}
                      <button type="button" role="menuitem" onClick={() => void signOut()} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-[12px] font-medium text-[var(--h-muted)] hover:bg-[var(--h-surface-inset)]"><NavIcon name="logout" /> Sign out</button>
                    </div>
                  )}
                </div>
              </>
            )}
            <button type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)} className="grid size-11 place-items-center rounded-full text-[var(--h-muted)] hover:bg-[var(--h-surface-inset)] min-[900px]:hidden"><Menu className="size-5" /></button>
          </div>
        </div>
      </header>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
        <div className="space-y-1">
          {variant === "public" && (
            <>
              {PUBLIC_NAV.map((item) => <MobileLink key={item.key} item={item} />)}
              <a href={ADMIN_LOGIN.href} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-[14px] font-semibold text-[var(--h-muted)]"><NavIcon name="login" /> Admin Login</a>
            </>
          )}
          {variant === "client" && (
            <>
              <MobileLink item={CLIENT_NAV[0]} />
              <details className="rounded-xl">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-[14px] font-semibold"><span className="flex items-center gap-2"><NavIcon name="casesOpen" /> Case Studies</span><ChevronDown className="size-4" /></summary>
                <div className="pl-3">{caseItems.map((item) => <MobileCaseLink key={item.href} item={item} />)}</div>
              </details>
              {CLIENT_NAV.slice(2).map((item) => <MobileLink key={item.key} item={item} />)}
              <div className="my-1 h-px bg-[var(--h-border)]/20" />
              <MobileLink item={ACCOUNT_ITEMS.security} />
              <MobileLink item={ACCOUNT_ITEMS.sessions} />
              <MobileLink item={ACCOUNT_ITEMS.password} />
            </>
          )}
          {variant === "owner" && (
            <>
              <MobileLink item={OWNER_NAV[0]} />
              <details className="rounded-xl">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-[14px] font-semibold"><span className="flex items-center gap-2"><NavIcon name="casesOpen" /> Case Studies</span><ChevronDown className="size-4" /></summary>
                <div className="pl-3">{caseItems.map((item) => <MobileCaseLink key={item.href} item={item} />)}<MobileLink item={CASE_DASHBOARD} /></div>
              </details>
              <MobileLink item={ACCOUNT_ITEMS.users} />
              <MobileLink item={ACCOUNT_ITEMS.sessions} />
              <MobileLink item={ACCOUNT_ITEMS.security} />
            </>
          )}
          {variant !== "public" && <button type="button" onClick={() => void signOut()} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-[14px] font-medium text-[var(--h-muted)]"><NavIcon name="logout" /> Sign out</button>}
        </div>
      </Sheet>
    </>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} data-nav-active={active || undefined} aria-current={active ? "page" : undefined} className={cn(linkClass, active && "site-group-inset text-[var(--h-ink)]")}>
      <NavIcon name={item.icon} />
      <span>{item.label}</span>
    </Link>
  );
}

function MenuLink({ item }: { item: NavItem }) {
  return <Link href={item.href} role="menuitem" className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-[12px] font-medium text-[var(--h-muted)] hover:bg-[var(--h-surface-inset)]"><NavIcon name={item.icon} /> {item.label}</Link>;
}

function MobileLink({ item }: { item: NavItem }) {
  return <Link href={item.href} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-[14px] font-semibold text-[var(--h-muted)]"><NavIcon name={item.icon} /> {item.label}</Link>;
}

function MobileCaseLink({ item }: { item: { href: string; label: string; hint: string; party: PartyId } }) {
  return (
    <Link href={item.href} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-[14px] font-semibold text-[var(--h-muted)]">
      <NavPartyMark party={item.party} />
      <span className="min-w-0"><span className="block">{item.label}</span><span className="block text-[10px] font-normal">{item.hint}</span></span>
    </Link>
  );
}
