"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

/**
 * Back to the case-study index. Uses history back when the previous entry is
 * the index so its scroll position survives, and a normal link otherwise.
 */
export default function CaseBackLink({ className, children }: { className?: string; children: ReactNode }) {
  const router = useRouter();

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    let previous: string | null = null;
    try { previous = sessionStorage.getItem("ro:previous-path"); } catch { /* ignore */ }
    if (previous === "/case-studies") {
      event.preventDefault();
      router.back();
    }
  }

  return <Link href="/case-studies" onClick={onClick} className={className}>{children}</Link>;
}
