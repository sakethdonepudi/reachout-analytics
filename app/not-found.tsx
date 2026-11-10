import Link from "next/link";
import { Logo } from "@/components/site/navbar";

export default function NotFound() {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-[var(--surface-canvas)] px-6 text-[var(--text-primary)]">
      <div className="w-full max-w-md rounded-[var(--radius-panel)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] p-8 text-center shadow-[var(--shadow-soft)]">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="type-h2 mt-7">Page not found</h1>
        <p className="type-small mt-2 text-[var(--text-muted)]">That page is not available.</p>
        <Link href="/" className="mt-6 inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent-brass)] px-4 text-[13px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brass)]">
          Back to home
        </Link>
      </div>
    </main>
  );
}
