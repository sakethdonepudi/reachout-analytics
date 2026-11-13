"use client";

import RoleHomeLink from "@/components/site/role-home-link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-[var(--surface-canvas)] px-6 text-[var(--text-primary)]">
      <div className="w-full max-w-md rounded-[var(--radius-panel)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] p-8 text-center shadow-[var(--shadow-soft)]">
        <p className="type-micro text-[var(--r-teal-d)]">ReachOut Analytics</p>
        <h1 className="type-h2 mt-3">Something went wrong</h1>
        <p className="type-small mt-2 text-[var(--text-muted)]">The page could not be loaded.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reset} className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--r-navy)] px-4 text-[13px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-navy)]">
            Try again
          </button>
          <RoleHomeLink className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-hairline)] px-4 text-[13px] font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-navy)]">
            Back to home
          </RoleHomeLink>
        </div>
      </div>
    </main>
  );
}
