"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Lock, LogOut, Menu, Settings, Shield, Users } from "lucide-react";
import { Logo } from "@/components/site/brand";
import { Sheet } from "@/components/ui/sheet";
import { useIdle } from "@/components/auth/idle-provider";
import { cn } from "@/lib/utils";

type CaseItem = { slug: string; title: string; state: string; year: number; draft: boolean };

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
const linkClass = "inline-flex h-9 items-center rounded-full px-3 text-[12.5px] font-semibold text-[var(--h-muted)] transition-colors hover:bg-[var(--h-surface-inset)] hover:text-[var(--h-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45";

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
  items: { href: string; label: string; hint?: string; icon?: React.ReactNode; active?: boolean }[];
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
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen((value) => !value); } }} className={cn(linkClass, "gap-1", (active || open) && "site-group-inset text-[var(--h-ink)]")}>
        {label}<ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div role="menu" className={cn("site-group absolute top-[calc(100%+8px)] z-50 w-64 rounded-2xl p-1.5 text-[var(--h-ink)]", align === "right" ? "right-0" : "left-0")}>
          {items.map((item) => (
            <Link key={item.href + item.label} href={item.href} role="menuitem" onClick={() => setOpen(false)} className={cn("flex min-h-10 items-start gap-2 rounded-xl px-3 py-2 text-[12.5px] font-medium transition-colors hover:bg-[var(--h-surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45", item.active && "site-group-inset")}>
              {item.icon}
              <span className="min-w-0"><span className="block">{item.label}</span>{item.hint && <span className="mt-0.5 block text-[10px] font-normal text-[var(--h-muted)]">{item.hint}</span>}</span>
            </Link>
          ))}
          {footer && <><div className="my-1 h-px bg-[var(--h-border)]/20" /><Link href={footer.href} role="menuitem" onClick={() => setOpen(false)} className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-[11.5px] font-semibold text-[var(--h-muted)] hover:bg-[var(--h-surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-brass)]/45">{footer.icon}{footer.label}</Link></>}
        </div>
      )}
    </div>
  );
}

export default function NavCore({ variant, displayName, username, organisation, signInAt, lastLoginAt, lastLoginDevice, cases = [] }: NavCoreProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { remainingMs } = useIdle();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
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

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  const grouped = cases.reduce<Record<string, CaseItem[]>>((acc, item) => {
    (acc[item.state] ??= []).push(item);
    return acc;
  }, {});
  const caseItems = Object.entries(grouped).flatMap(([state, rows]) => rows.map((row) => ({ href: `/case-studies/${row.slug}`, label: row.title, hint: `${state} · ${row.year}${row.draft ? " · Draft" : ""}` })));


  return (
    <>
      <header className="site-header pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-2 sm:px-4">
        <div className={cn("site-group pointer-events-auto mx-auto flex h-[52px] w-full max-w-[1240px] items-center gap-2 rounded-full px-3 sm:h-[56px] sm:px-4", glass)}>
          <Logo href={home} className="h-[26px] w-[116px] sm:h-[28px] sm:w-[126px]" />
          <nav className="ml-2 hidden items-center gap-0.5 md:flex" aria-label="Primary">
            {variant === "public" && (
              <>
                <Link href="/" className={linkClass}>Home</Link>
                <Link href="/services" className={linkClass}>Services</Link>
                <Link href="/services/research-content" className={linkClass}>Research</Link>
                <Link href="/case-studies" className={cn(linkClass, "gap-1")}><Lock className="size-3" aria-hidden /> Case Studies</Link>
                <Link href="/about" className={linkClass}>About Us</Link>
                <Link href="/#contact" className={linkClass}>Contact</Link>
              </>
            )}
            {variant === "client" && (
              <>
                <Link href="/" className={linkClass}>Home</Link>
                {caseItems.length === 1 ? <Link href={caseItems[0].href} className={linkClass}>Case Studies</Link> : <Dropdown label="Case Studies" items={caseItems} active={pathname?.startsWith("/case-studies")} />}
              </>
            )}
            {variant === "owner" && (
              <>
                <Link href="/dashboard" className={cn(linkClass, pathname === "/dashboard" && "site-group-inset text-[var(--h-ink)]")}>Dashboard</Link>
                <Dropdown label="Case Studies" items={caseItems} footer={{ href: "/dashboard/case-studies", label: "Case studies dashboard", icon: <Settings className="size-3.5" /> }} active={pathname?.startsWith("/case-studies") || pathname === "/dashboard/case-studies"} />
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            {variant === "public" ? (
              <Link href="/login" className="hidden h-9 items-center rounded-full bg-[var(--r-navy)] px-4 text-[12px] font-semibold text-white md:inline-flex">Login</Link>
            ) : (
              <>
                <div ref={accountRef} className="relative hidden md:block">
                  <button type="button" onClick={() => setAccountOpen((value) => !value)} aria-haspopup="menu" aria-expanded={accountOpen} aria-label="Account menu" className={cn("inline-flex h-9 items-center gap-2 rounded-full px-2 text-[12px] font-semibold text-[var(--h-ink)] hover:bg-[var(--h-surface-inset)]", accountOpen && "site-group-inset")}>
                    <span className="grid size-7 place-items-center rounded-full bg-[var(--r-navy)] text-[10px] font-bold text-white">{initials(displayName ?? "User")}</span>
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
                          <MenuLink href="/account/users" icon={<Users className="size-3.5" />}>Users</MenuLink>
                          <MenuLink href="/account/sessions" icon={<Shield className="size-3.5" />}>Sessions</MenuLink>
                          <MenuLink href="/account/security" icon={<Shield className="size-3.5" />}>Security</MenuLink>
                        </>
                      )}
                      {variant === "client" && (
                        <>
                          <MenuLink href="/account/password">Change password</MenuLink>
                          <MenuLink href="/account/security" icon={<Shield className="size-3.5" />}>Security</MenuLink>
                        </>
                      )}
                      <button type="button" role="menuitem" onClick={() => void signOut()} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-[12px] font-medium text-[var(--h-muted)] hover:bg-[var(--h-surface-inset)]"><LogOut className="size-3.5" /> Sign out</button>
                    </div>
                  )}
                </div>
              </>
            )}
            <button type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)} className="grid size-10 place-items-center rounded-full text-[var(--h-muted)] hover:bg-[var(--h-surface-inset)] md:hidden"><Menu className="size-5" /></button>
          </div>
        </div>
      </header>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
        <div className="space-y-1">
          {variant === "public" && (
            <>
              <MobileLink href="/">Home</MobileLink>
              <MobileLink href="/services">Services</MobileLink>
              <MobileLink href="/services/research-content">Research</MobileLink>
              <MobileLink href="/case-studies"><Lock className="size-3.5" /> Case Studies</MobileLink>
              <MobileLink href="/about">About Us</MobileLink>
              <MobileLink href="/#contact">Contact</MobileLink>
              <MobileLink href="/login">Login</MobileLink>
            </>
          )}
          {variant === "client" && (
            <>
              <MobileLink href="/">Home</MobileLink>
              <details className="rounded-xl"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-[14px] font-semibold">Case Studies<ChevronDown className="size-4" /></summary><div className="pl-3">{caseItems.map((item) => <MobileLink key={item.href} href={item.href}>{item.label}<span className="block text-[10px] font-normal text-[var(--h-muted)]">{item.hint}</span></MobileLink>)}</div></details>
            </>
          )}
          {variant === "owner" && (
            <>
              <MobileLink href="/dashboard">Dashboard</MobileLink>
              <details className="rounded-xl"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-[14px] font-semibold">Case Studies<ChevronDown className="size-4" /></summary><div className="pl-3">{caseItems.map((item) => <MobileLink key={item.href} href={item.href}>{item.label}</MobileLink>)}<MobileLink href="/dashboard/case-studies"><Settings className="size-4" /> Case studies dashboard</MobileLink></div></details>

              <MobileLink href="/account/users">Users</MobileLink>
              <MobileLink href="/account/sessions">Sessions</MobileLink>
              <MobileLink href="/account/security">Security</MobileLink>
            </>
          )}
          {variant !== "public" && <button type="button" onClick={() => void signOut()} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-[14px] font-medium text-[var(--h-muted)]"><LogOut className="size-4" /> Sign out</button>}
        </div>
      </Sheet>
    </>
  );
}

function MenuLink({ href, children, icon }: { href: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return <Link href={href} role="menuitem" className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-[12px] font-medium text-[var(--h-muted)] hover:bg-[var(--h-surface-inset)]">{icon}{children}</Link>;
}

function MobileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-[14px] font-semibold text-[var(--h-muted)]">{children}</Link>;
}
