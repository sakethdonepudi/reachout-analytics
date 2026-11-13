"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-[#FAFAF7] text-[#222222]" style={{ fontFamily: "system-ui, sans-serif" }}>
        <main className="grid min-h-[100svh] place-items-center px-6">
          <div className="w-full max-w-md rounded-2xl border border-[#E4E2DA] bg-white p-8 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1D9E75]">ReachOut Analytics</p>
            <h1 className="mt-3 text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-[#5F5E5A]">The page could not be loaded.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={reset} className="min-h-10 rounded-lg bg-[#1F4E78] px-4 text-[13px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4E78]">Try again</button>
              <a href="/" className="min-h-10 rounded-lg border border-[#E4E2DA] px-4 text-[13px] font-semibold text-[#5F5E5A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4E78]">Back to home</a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
