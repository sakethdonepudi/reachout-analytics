"use client";

import { useEffect, useState } from "react";

/** True only after a pending action has lasted longer than the Doherty threshold. */
export function useDelayedFlag(active: boolean, delay = 400): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) { setVisible(false); return; }
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [active, delay]);

  return visible;
}
