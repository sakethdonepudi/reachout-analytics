import Link from "next/link";
import { Logo } from "@/components/site/brand";
import { LOGIN } from "@/lib/nav";

const links = [
  ["/", "Home"],
  ["/case-studies", "Case Studies"],
] as const;

export default function PublicNavbarStatic() {
  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <Logo href="/" className="h-[24px] w-[108px]" />
        <nav className="ml-3 hidden items-center gap-0.5 md:flex" aria-label="Primary">
          {links.map(([href, label]) => <Link key={href} href={href} className="site-nav-link">{label}</Link>)}
        </nav>
        <a href={LOGIN.href} className="hit-expand ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#0B0B0C] px-4 text-[12px] font-semibold text-[#0B0B0C] transition-colors hover:bg-[#0B0B0C] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B0B0C] focus-visible:ring-offset-2">{LOGIN.label}</a>
      </div>
    </header>
  );
}
