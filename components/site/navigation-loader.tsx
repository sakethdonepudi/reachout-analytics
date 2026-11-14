"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import SignalLoader from "@/components/ui/signal-loader";
import { OPENING_EVENT, type OpeningDetail } from "@/lib/use-navigate";
import { TRANSITION_EVENT } from "@/lib/route-transition";
import { routeLabel } from "@/lib/route-labels";

type Phase = "idle" | "bar" | "full";
type Opening = { label: string; phase: Phase };

export default function NavigationLoader() {
  const pathname = usePathname();
  const [opening, setOpening] = useState<Opening | null>(null);
  const coverActive = useRef(false);
  const barTimer = useRef(0);
  const fullTimer = useRef(0);

  useEffect(() => {
    window.clearTimeout(barTimer.current);
    window.clearTimeout(fullTimer.current);
    setOpening(null);
    coverActive.current = false;
  }, [pathname]);

  useEffect(() => {
    const show = (label: string | null, immediate = false) => {
      window.clearTimeout(barTimer.current);
      window.clearTimeout(fullTimer.current);
      if (!label || coverActive.current) return;
      if (immediate) {
        setOpening({ label, phase: "full" });
        return;
      }
      // Under 250ms nothing shows, 250 to 800ms is a slim progress bar,
      // and a slow or full document load upgrades to the signal loader.
      barTimer.current = window.setTimeout(() => {
        if (coverActive.current) return;
        if (document.querySelector('[data-testid="signal-loader"]')) return;
        setOpening({ label, phase: "bar" });
      }, 250);
      fullTimer.current = window.setTimeout(() => {
        if (coverActive.current) return;
        if (document.querySelector('[data-testid="signal-loader"]')) return;
        setOpening({ label, phase: "full" });
      }, 800);
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      if (!target) return;
      const explicit = target.closest<HTMLElement>("[data-opening-label]")?.dataset.openingLabel ?? null;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) {
        if (explicit) show(explicit);
        return;
      }
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      let url: URL;
      try { url = new URL(anchor.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      show(routeLabel(url.pathname, explicit));
    };

    const onOpening = (event: Event) => {
      const detail = (event as CustomEvent<OpeningDetail>).detail;
      show(detail?.label ?? null, detail?.immediate);
    };
    const onCover = () => {
      coverActive.current = true;
      window.clearTimeout(barTimer.current);
      window.clearTimeout(fullTimer.current);
      setOpening(null);
    };
    const onReady = () => {
      window.clearTimeout(barTimer.current);
      window.clearTimeout(fullTimer.current);
      setOpening(null);
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener(OPENING_EVENT, onOpening);
    window.addEventListener(TRANSITION_EVENT, onCover);
    window.addEventListener("reachout:ready", onReady);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.clearTimeout(barTimer.current);
      window.clearTimeout(fullTimer.current);
      window.removeEventListener(OPENING_EVENT, onOpening);
      window.removeEventListener(TRANSITION_EVENT, onCover);
      window.removeEventListener("reachout:ready", onReady);
    };
  }, []);

  if (!opening) return null;
  if (opening.phase === "bar") {
    return (
      <div className="nav-progress" data-testid="nav-progress" role="status" aria-label={`Loading ${opening.label}`}>
        <span />
      </div>
    );
  }
  return <SignalLoader active label={opening.label} delay={0} />;
}
