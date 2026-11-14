import Link from "next/link";
import { Logo } from "@/components/site/brand";
import { NavIcon } from "@/components/site/nav-icon";
import { PUBLIC_NAV } from "@/lib/nav";

export default function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-[var(--p-line)] bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Logo variant="light" className="h-8 w-[124px]" />
          <p className="mt-3 text-[11.5px] text-[var(--p-muted)]">© 2026 ReachOut Analytics Pvt. Ltd.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {PUBLIC_NAV.map((item) => (
            <Link key={item.key} href={item.href} className="inline-flex min-h-10 items-center gap-1.5 text-[12.5px] font-medium text-[var(--p-ink-2)] transition-colors hover:text-[var(--p-ink)]">
              <NavIcon name={item.icon} className="size-3.5" /> {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
