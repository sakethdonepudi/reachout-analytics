"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { tierForPath } from "@/lib/motion";

/** Applies the frequency tier and pauses decorative animation on hidden tabs. */
export default function MotionTier() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.dataset.motionTier = tierForPath(pathname);
  }, [pathname]);

  useEffect(() => {
    const apply = () => { document.documentElement.dataset.hidden = String(document.hidden); };
    apply();
    document.addEventListener("visibilitychange", apply);
    return () => document.removeEventListener("visibilitychange", apply);
  }, []);

  return null;
}
