export default function Loading() {
  return (
    <main className="min-h-screen bg-white pt-28 text-[var(--p-ink)] sm:pt-32" aria-busy="true" aria-label="Opening Case Studies">
      <div className="mx-auto max-w-6xl px-6 pb-24 sm:px-10">
        <div className="h-4 w-40 animate-pulse rounded bg-[var(--p-line)]" />
        <div className="mt-8 h-10 w-72 animate-pulse rounded bg-[var(--p-line)]" />
        <div className="mt-4 h-4 w-full max-w-xl animate-pulse rounded bg-[var(--p-line)]" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-40 animate-pulse rounded-2xl border border-[var(--p-line)] bg-[var(--p-surface)] p-5">
              <div className="h-10 w-10 rounded-full bg-[var(--p-line)]" />
              <div className="mt-4 h-4 w-40 rounded bg-[var(--p-line)]" />
              <div className="mt-2 h-3 w-24 rounded bg-[var(--p-line)]" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
