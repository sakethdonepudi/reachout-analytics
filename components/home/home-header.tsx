"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Menu } from "lucide-react";
import { Logo } from "@/components/site/brand";
import { Sheet } from "@/components/ui/sheet";
import { useIdle } from "@/components/auth/idle-provider";
import { announceOpening } from "@/lib/use-navigate";

export type HomeCase = { slug: string; party: string; stateName: string };

function idleLabel(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function HomeHeader({
  role,
  displayName,
  cases,
}: {
  role: "anon" | "client";
  displayName?: string | null;
  cases: HomeCase[];
}) {
  const { remainingMs } = useIdle();
  const [casesOpen, setCasesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const casesRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

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

  const grouped = cases.reduce<Record<string, HomeCase[]>>((acc, item) => {
    (acc[item.stateName] ??= []).push(item);
    return acc;
  }, {});

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-[#E6E6E6] bg-white">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-5 sm:px-10 lg:px-16">
          <Logo variant="light" className="h-8 w-[124px] shrink-0" />

          <div className="flex items-center gap-1">
            <Link href="/" className="hidden min-h-10 items-center rounded-md px-3 text-[13px] font-medium text-[#0B0B0C] hover:bg-[#F5F5F5] md:inline-flex">
              Home
            </Link>

            {role === "client" ? (
              <>
                <div ref={casesRef} className="relative hidden md:block">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={casesOpen}
                    onClick={() => setCasesOpen((value) => !value)}
                    className="inline-flex min-h-10 items-center gap-1 rounded-md px-3 text-[13px] font-medium text-[#0B0B0C] hover:bg-[#F5F5F5]"
                  >
                    Case Studies <ChevronDown className={casesOpen ? "size-3 rotate-180 transition-transform duration-150" : "size-3 transition-transform duration-150"} aria-hidden />
                  </button>
                  <div role="menu" data-open={casesOpen} aria-hidden={!casesOpen} className="home-menu absolute right-0 top-[calc(100%+8px)] z-50 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-[#E6E6E6] bg-white p-2 shadow-[0_10px_30px_rgba(0,0,0,.08)]">
                    {Object.entries(grouped).map(([state, items]) => (
                      <div key={state} className="mb-1 last:mb-0">
                        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8A8A]">{state}</p>
                        {items.map((item) => (
                          <Link key={item.slug} href={`/case-studies/${item.slug}`} role="menuitem" onClick={() => setCasesOpen(false)} className="flex min-h-10 items-center rounded-lg px-2 text-[13px] font-medium text-[#0B0B0C] hover:bg-[#F5F5F5]">
                            {item.party} · {item.stateName}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <div ref={accountRef} className="relative hidden md:block">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={accountOpen}
                    onClick={() => setAccountOpen((value) => !value)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-[13px] font-medium text-[#0B0B0C] hover:bg-[#F5F5F5]"
                  >
                    <span className="grid size-7 place-items-center rounded-full bg-[#0B0B0C] text-[10px] font-bold text-white">{(displayName ?? "You").split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span>
                    <span className="max-w-[110px] truncate">{displayName ?? "Account"}</span>
                    <span className="text-[9.5px] tabular-nums text-[#8A8A8A]">{idleLabel(remainingMs)}</span>
                  </button>
                  <div role="menu" data-open={accountOpen} aria-hidden={!accountOpen} className="home-menu absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-xl border border-[#E6E6E6] bg-white p-2 shadow-[0_10px_30px_rgba(0,0,0,.08)]">
                    <p className="px-2 pb-1 text-[11px] text-[#6B6B6B]">Signs out in {idleLabel(remainingMs)}</p>
                    <button type="button" role="menuitem" onClick={() => void signOut()} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-[#0B0B0C] hover:bg-[#F5F5F5]">
                      <LogOut className="size-3.5" /> Sign out
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <a href="/login" className="hidden min-h-10 items-center rounded-[10px] border border-[#0B0B0C] px-4 text-[13px] font-semibold text-[#0B0B0C] transition-colors hover:bg-[#0B0B0C] hover:text-white md:inline-flex">
                Admin Login
              </a>
            )}

            <button type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)} className="grid size-11 place-items-center rounded-md text-[#0B0B0C] hover:bg-[#F5F5F5] md:hidden">
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
        <div className="space-y-1">
          <Link href="/" className="flex min-h-11 items-center rounded-lg px-3 text-[15px] font-semibold text-[#0B0B0C]">Home</Link>
          {role === "client" ? (
            <>
              {cases.map((item) => (
                <Link key={item.slug} href={`/case-studies/${item.slug}`} className="flex min-h-11 items-center rounded-lg px-3 text-[14px] font-medium text-[#0B0B0C]">
                  {item.party} · {item.stateName}
                </Link>
              ))}
              <p className="px-3 pt-2 text-[11px] text-[#6B6B6B]">Signs out in {idleLabel(remainingMs)}</p>
              <button type="button" onClick={() => void signOut()} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-[14px] font-medium text-[#0B0B0C]">
                <LogOut className="size-4" /> Sign out
              </button>
            </>
          ) : (
            <a href="/login" className="flex min-h-11 items-center rounded-lg px-3 text-[14px] font-semibold text-[#0B0B0C]">Admin Login</a>
          )}
        </div>
      </Sheet>
    </>
  );
}
