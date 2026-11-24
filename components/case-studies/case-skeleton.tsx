/**
 * Layout-matched skeleton for a case study route. It replaces the full-screen
 * spinner so the header, cards and chart frame are visible immediately.
 */
export default function CaseSkeleton({ label = "Opening case study" }: { label?: string }) {
  return (
    <main className="tn-dashboard relative min-h-0 bg-[color:var(--theme-surface)] text-[var(--p-ink)]" aria-busy="true" aria-label={label}>
      <div className="mx-auto w-full max-w-[1680px] px-4 pb-20 pt-20 sm:px-6 xl:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="h-9 w-36 animate-pulse rounded-full bg-[color:var(--theme-surface-2)]" />
          <span className="h-11 w-52 animate-pulse rounded-full bg-[color:var(--theme-surface-2)]" />
          <span className="ml-auto h-5 w-28 animate-pulse rounded bg-[color:var(--theme-surface-2)]" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 min-[900px]:grid-cols-2 min-[1100px]:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="min-h-[132px] rounded-2xl border-2 border-[color:var(--theme-border)] bg-[color:var(--theme-surface-2)] p-4 sm:min-h-[124px]">
              <div className="h-4 w-24 animate-pulse rounded bg-[color:var(--theme-border)]" />
              <div className="mt-3 h-3 w-full animate-pulse rounded bg-[color:var(--theme-border)]" />
              <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-[color:var(--theme-border)]" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <span className="h-11 w-20 animate-pulse rounded-full bg-[color:var(--theme-surface-2)]" />
          <span className="h-11 w-24 animate-pulse rounded-full bg-[color:var(--theme-surface-2)]" />
          <span className="h-11 w-24 animate-pulse rounded-full bg-[color:var(--theme-surface-2)]" />
        </div>
        <div className="mt-3 rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-5">
          <div className="h-5 w-48 animate-pulse rounded bg-[color:var(--theme-border)]" />
          <div className="mt-4 h-10 w-full animate-pulse rounded-full bg-[color:var(--theme-surface-2)]" />
          <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-[color:var(--theme-surface-2)]" />
        </div>
        <div className="mt-3 rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-5">
          <div className="h-5 w-56 animate-pulse rounded bg-[color:var(--theme-border)]" />
          <div className="mt-4 grid gap-2">
            {[0, 1, 2, 3, 4].map((index) => <div key={index} className="h-9 animate-pulse rounded-lg bg-[color:var(--theme-surface-2)]" />)}
          </div>
        </div>
        <span className="sr-only">{label}</span>
      </div>
    </main>
  );
}
