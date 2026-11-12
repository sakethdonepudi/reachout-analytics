"use client";

export type OpenLink = { href: string | null | undefined; label: string };

export default function OpenMenu({ links }: { links: OpenLink[] }) {
  const visible = links.filter((item): item is { href: string; label: string } => Boolean(item.href));
  if (!visible.length) return null;
  return (
    <details className="relative inline-block">
      <summary className="cursor-pointer list-none rounded-md border border-[var(--r-line)] px-2 py-1 text-[11px] font-semibold text-[var(--r-navy)]">Open</summary>
      <div className="site-nav-menu right-0 mt-1 w-48">
        {visible.map((item) => <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer">{item.label}</a>)}
      </div>
    </details>
  );
}
