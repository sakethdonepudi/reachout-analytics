import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import CornerBrackets from "@/components/precision/corner-brackets";

const base = "group relative rounded-[16px] border border-[var(--p-line)] bg-white shadow-[var(--p-shadow)] transition-transform duration-200";

export function PrecisionCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(base, className)}>{children}</div>;
}

export function PrecisionCardLink({ href, children, className, label }: { href: string; children: ReactNode; className?: string; label?: string }) {
  return (
    <Link href={href} aria-label={label} className={cn(base, "block hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-ink)] focus-visible:ring-offset-2", className)}>
      {children}
      <CornerBrackets className="opacity-0 transition-opacity duration-200 group-hover:opacity-100" inset={-5} />
    </Link>
  );
}
