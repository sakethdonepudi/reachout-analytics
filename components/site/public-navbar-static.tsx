import Link from "next/link";
import { Logo } from "@/components/site/brand";

const links = [
  ["/", "Home"],
  ["/services", "Services"],
  ["/services/research-content", "Research"],
  ["/case-studies", "Case Studies"],
  ["/about", "About Us"],
  ["/#contact", "Contact"],
] as const;

export default function PublicNavbarStatic() {
  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <Logo href="/" className="h-[24px] w-[108px]" />
        <nav className="ml-3 hidden items-center gap-0.5 md:flex" aria-label="Primary">
          {links.map(([href, label]) => <Link key={href} href={href} className="site-nav-link">{label}</Link>)}
        </nav>
        <a href="/login" className="ml-auto inline-flex h-9 items-center rounded-md bg-[var(--r-navy)] px-4 text-[12px] font-semibold text-white">Login</a>
      </div>
    </header>
  );
}
