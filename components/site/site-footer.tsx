import Link from "next/link";
import { ThemeLogo } from "@/components/site/theme-logo";
import { CASES, UPCOMING } from "@/lib/cases";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative z-10 border-t border-[color:var(--theme-border)] bg-[color:var(--theme-bg)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:px-10 lg:grid-cols-[1.2fr_0.9fr_auto] lg:gap-16 lg:py-16">
        <div>
          <ThemeLogo className="h-8 w-[132px]" />
          <p className="mt-4 font-display text-[15px] font-semibold tracking-[-0.01em] text-[color:var(--theme-text)]">Political Analysis</p>
        </div>

        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[color:var(--theme-text-3)]">Experience</p>
          <ul className="mt-3 space-y-2 text-[12.5px] text-[color:var(--theme-text-2)]">
            <li>Since 2023</li>
            <li>{CASES.length} state campaigns</li>
            <li>Upcoming: {UPCOMING.map((item) => item.title).join(", ")}</li>
          </ul>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap items-start gap-x-6 gap-y-2 lg:flex-col lg:items-end">
          <Link href="/" className="inline-flex min-h-10 items-center text-[12.5px] font-medium text-[color:var(--theme-text-2)] transition-colors hover:text-[color:var(--theme-text)]">Home</Link>
          <Link href="/case-studies" className="inline-flex min-h-10 items-center text-[12.5px] font-medium text-[color:var(--theme-text-2)] transition-colors hover:text-[color:var(--theme-text)]">Case Studies</Link>
        </nav>
      </div>
      <div className="border-t border-[color:var(--theme-border)]">
        <div className="mx-auto max-w-6xl px-6 py-5 text-[11px] text-[color:var(--theme-text-2)] sm:px-10">© {year} ReachOut Analytics. Since 2023.</div>
      </div>
    </footer>
  );
}
