"use client";

import RoleHomeLink from "@/components/site/role-home-link";
import GeoBackdrop from "@/components/precision/geo-backdrop";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="relative grid min-h-[100svh] place-items-center overflow-hidden bg-white px-6 text-[var(--p-ink)]">
      <GeoBackdrop mask="none" className="opacity-70" />
      <div className="relative w-full max-w-md rounded-[16px] border border-[var(--p-line)] bg-white p-8 text-center shadow-[var(--p-shadow)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--p-muted)]">ReachOut Analytics</p>
        <h1 className="mt-3 font-display text-[clamp(32px,4vw,44px)] font-bold tracking-[-0.03em]">Something went wrong</h1>
        <p className="mt-2 text-[14px] text-[var(--p-ink-2)]">The page could not be loaded.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-[#0B0B0C] px-5 text-[13px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B0B0C] focus-visible:ring-offset-2">
            Try again
          </button>
          <RoleHomeLink className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-[#CFCFCF] px-5 text-[13px] font-semibold text-[var(--p-ink-2)] hover:border-[#0B0B0C] hover:text-[var(--p-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B0B0C] focus-visible:ring-offset-2">
            Back to home
          </RoleHomeLink>
        </div>
      </div>
    </main>
  );
}
