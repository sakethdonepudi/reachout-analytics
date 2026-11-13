"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const KEY = "ro:previous-path";

/** Remembers the pathname before the current one for history-aware back links. */
export default function RouteHistory() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);
  useState(() => {
    if (typeof window !== "undefined") {
      try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    }
    return true;
  });

  useEffect(() => {
    if (previous.current && previous.current !== pathname) {
      try { sessionStorage.setItem(KEY, previous.current); } catch { /* ignore */ }
    }
    previous.current = pathname;
  }, [pathname]);

  return null;
}
