"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import SignalLoader from "@/components/ui/signal-loader";

const CASE_LABELS: Record<string, string> = {
  "tamil-nadu": "Opening Tamil Nadu",
  telangana: "Opening Telangana",
  "north-east-elections": "Opening North East",
  "andhra-pradesh-2024": "Opening Andhra Pradesh",
  gujarat: "Opening Gujarat",
  bihar: "Opening Bihar",
  "karnataka-2023": "Opening Karnataka",
};

function labelFor(pathname: string, explicit?: string | null): string | null {
  if (explicit) return explicit;
  if (pathname === "/case-studies" || pathname === "/case-studies/") return "Opening Case Studies";
  if (!pathname.startsWith("/case-studies/")) return null;
  const slug = pathname.slice("/case-studies/".length).split("/")[0];
  return CASE_LABELS[slug] ?? "Opening Case Study";
}

export default function NavigationLoader() {
  const pathname = usePathname();
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(null);
  }, [pathname]);

  useEffect(() => {
    let hideTimer = 0;
    const show = (next: string | null) => {
      if (!next) return;
      setLabel(next);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setLabel(null), 15_000);
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      const explicit = target.closest<HTMLElement>("[data-opening-label]")?.dataset.openingLabel ?? null;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) {
        if (explicit) show(labelFor("", explicit));
        return;
      }
      let url: URL;
      try { url = new URL(anchor.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      show(labelFor(url.pathname, explicit));
    };
    const onOpening = (event: Event) => {
      const detail = (event as CustomEvent<{ label?: string }>).detail;
      show(detail?.label ?? null);
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("reachout:opening", onOpening);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("reachout:opening", onOpening);
      window.clearTimeout(hideTimer);
    };
  }, []);

  return <SignalLoader active={Boolean(label)} label={label ?? "Opening"} />;
}
