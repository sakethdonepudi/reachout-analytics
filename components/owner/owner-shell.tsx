"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { FolderOpen, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck, Users, X } from "lucide-react";
import { Logo } from "@/components/site/brand";
import { broadcastLogout } from "@/lib/session-channel";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/case-studies", label: "Case Studies", Icon: FolderOpen },
  { href: "/account/users", label: "Users", Icon: Users },
  { href: "/account/security", label: "Security", Icon: ShieldCheck },
] as const;

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "O";
}

export default function OwnerShell({ children, displayName, username }: { children: ReactNode; displayName: string; username: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("ro:owner-sidebar") === "collapsed"); } catch { /* storage can be blocked */ }
  }, []);

  useEffect(() => { setDrawer(false); }, [pathname]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawer(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  function toggle() {
    setCollapsed((value) => {
      const next = !value;
      try { localStorage.setItem("ro:owner-sidebar", next ? "collapsed" : "open"); } catch { /* storage can be blocked */ }
      return next;
    });
  }

  async function signOut() {
    broadcastLogout();
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/login");
  }

  const active = (href: string) => href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`);

  const sidebar = (mobile = false) => (
    <aside
      aria-label="Owner navigation"
      className={cn(
        "flex h-full flex-col border-r border-[#EAEAEA] bg-white",
        mobile ? "w-72" : "fixed inset-y-0 left-0 z-40 transition-[width] duration-200",
        !mobile && (collapsed ? "w-16" : "w-60"),
      )}
    >
      <div className={cn("flex h-16 shrink-0 items-center border-b border-[#EAEAEA]", collapsed && !mobile ? "justify-center px-2" : "justify-between px-4")}>
        {!collapsed || mobile ? <Logo variant="light" className="h-7 w-[106px]" /> : <Logo variant="light" className="h-6 w-8 overflow-hidden" />}
        {!mobile && (
          <button type="button" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="grid size-9 shrink-0 place-items-center rounded-lg text-[#6B6B6B] hover:bg-[#F4F4F5] hover:text-[#0B0B0C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B0B0C]/40">
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        )}
        {mobile && <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="grid size-9 place-items-center rounded-lg text-[#6B6B6B] hover:bg-[#F4F4F5]"><X className="size-4" /></button>}
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4">
        {NAV.map(({ href, label, Icon }) => {
          const isActive = active(href);
          return (
            <Link key={href} href={href} onClick={() => setDrawer(false)} title={collapsed && !mobile ? label : undefined} className={cn(
              "relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B0B0C]/40",
              isActive ? "bg-[#F4F4F5] text-[#0B0B0C]" : "text-[#6B6B6B] hover:bg-[#FAFAFA] hover:text-[#0B0B0C]",
              collapsed && !mobile && "justify-center px-0",
            )}>
              {isActive && <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-[#0B0B0C]" aria-hidden />}
              <Icon className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
              {(!collapsed || mobile) && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={cn("shrink-0 border-t border-[#EAEAEA] p-2", collapsed && !mobile && "flex flex-col items-center")}>
        <Link href="/" className={cn("flex min-h-10 items-center gap-2 rounded-lg px-3 text-[12px] font-medium text-[#6B6B6B] hover:bg-[#FAFAFA] hover:text-[#0B0B0C]", collapsed && !mobile && "justify-center px-0")} title="Main website">
          <span className="grid size-7 place-items-center rounded-full border border-[#EAEAEA] text-[11px] font-bold" aria-hidden>↗</span>
          {(!collapsed || mobile) && <span>Main website</span>}
        </Link>
        <div className={cn("mt-2 flex items-center gap-2 rounded-xl border border-[#EAEAEA] p-2", collapsed && !mobile && "justify-center border-0 p-0")}>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#0B0B0C] text-[10px] font-bold text-white">{initials(displayName)}</span>
          {(!collapsed || mobile) && <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold text-[#0B0B0C]">{displayName}</p><p className="truncate text-[10.5px] text-[#6B6B6B]">@{username}</p></div>}
          <button type="button" onClick={() => void signOut()} aria-label="Log out" title="Log out" className="grid size-8 shrink-0 place-items-center rounded-lg text-[#6B6B6B] hover:bg-[#F4F4F5] hover:text-[#0B0B0C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B0B0C]/40"><LogOut className="size-4" /></button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="lg:hidden">
        <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-[#EAEAEA] bg-white px-3">
          <button type="button" onClick={() => setDrawer(true)} aria-label="Open menu" className="grid size-10 place-items-center rounded-lg text-[#0B0B0C] hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B0B0C]/40"><Menu className="size-5" /></button>
          <Logo variant="light" className="h-7 w-[106px]" />
          <span className="size-10" aria-hidden />
        </div>
      </div>

      <div className="hidden lg:block">{sidebar()}</div>

      <div className={cn("min-h-screen pt-14 transition-[padding] duration-200 lg:pt-0", collapsed ? "lg:pl-16" : "lg:pl-60")} data-owner-content>
        {children}
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Owner menu">
          <button type="button" aria-label="Close menu" onClick={() => setDrawer(false)} className="absolute inset-0 bg-black/25" />
          <div className="absolute inset-y-0 left-0 shadow-[12px_0_40px_rgba(0,0,0,0.12)]">{sidebar(true)}</div>
        </div>
      )}
    </div>
  );
}
