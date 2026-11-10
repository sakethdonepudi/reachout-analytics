"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-[#11151b] text-[#f3f5f7]">
        <main className="grid min-h-[100svh] place-items-center px-6">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#1b222c] p-8 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffb866]">ReachOut Analytics</p>
            <h1 className="mt-3 text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-[#adb7c4]">The page could not be loaded.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={reset} className="min-h-10 rounded-lg bg-[#ffb866] px-4 text-[13px] font-semibold text-[#11151b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb866]">Try again</button>
              <a href="/" className="min-h-10 rounded-lg border border-white/15 px-4 text-[13px] font-semibold text-[#adb7c4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb866]">Back to home</a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
