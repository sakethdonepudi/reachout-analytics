"use client";

import Link from "next/link";

export function Logo({ className, variant = "auto", linked = true, href = "/" }: { className?: string; variant?: "auto" | "light" | "dark"; linked?: boolean; href?: string }) {
  const imageClass = "h-[28px] w-full object-contain object-left sm:h-[32px]";
  const light = <img src="/brand/reachout-logo-light.svg" alt="Reachout Analytics" width={1290} height={285} className={imageClass} decoding="async" draggable={false} />;
  const dark = <img src="/brand/reachout-logo-dark.svg" alt="Reachout Analytics" width={1290} height={285} className={imageClass} decoding="async" draggable={false} />;
  const artwork = variant === "dark" ? dark : light;
  const classes = ["brand-link hit-expand relative flex h-10 w-[124px] shrink-0 items-center sm:w-[142px]", linked && "hover:opacity-85", className].filter(Boolean).join(" ");
  return linked ? <Link href={href} aria-label="Reachout Analytics" className={classes}>{artwork}</Link> : <span className={classes} aria-hidden>{artwork}</span>;
}
