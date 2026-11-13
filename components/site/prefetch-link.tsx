"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

/** A Link that also prefetches its route on hover or keyboard focus. */
export default function PrefetchLink({ href, onMouseEnter, onFocus, ...rest }: ComponentProps<typeof Link>) {
  const router = useRouter();
  const target = typeof href === "string" ? href : href.pathname ?? "";

  return (
    <Link
      href={href}
      onMouseEnter={(event) => { if (target) router.prefetch(target); onMouseEnter?.(event); }}
      onFocus={(event) => { if (target) router.prefetch(target); onFocus?.(event); }}
      {...rest}
    />
  );
}
