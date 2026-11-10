import Link from "next/link";
import { Logo } from "@/components/site/navbar";

export const dynamic = "force-dynamic";

export default function NoAccessPage() {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-[0_24px_60px_-34px_rgba(15,20,30,.45)]">
        <div className="flex justify-center"><Logo /></div>
        <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.2em] text-saffron-2">Access restricted</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em]">This account does not have access</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          Ask a ReachOut owner to add your Google account, then try again.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-saffron px-4 py-2.5 text-sm font-semibold text-[#241203] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50"
        >
          Try another account
        </Link>
        <div className="mt-4 text-[12px] text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Back to site</Link>
        </div>
      </div>
    </main>
  );
}
