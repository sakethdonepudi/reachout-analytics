"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import SignalLoader from "@/components/ui/signal-loader";
import { OPENING_EVENT, type OpeningDetail } from "@/lib/use-navigate";
import { TRANSITION_EVENT } from "@/lib/route-transition";
import { routeLabel } from "@/lib/route-labels";

type Opening = { label: string; immediate: boolean };

export default function NavigationLoader() {
  const pathname = usePathname();
  const [opening, setOpening] = useState<Opening | null>(null);
  const coverActive = useRef(false);
  const showTimer = useRef(0);

  useEffect(() => {
    window.clearTimeout(showTimer.current);
    setOpening(null);
    coverActive.current = false;
  }, [pathname]);

  useEffect(() => {
    const show = (label: string | null, immediate = false) => {
      window.clearTimeout(showTimer.current);
      if (!label || coverActive.current) return;
      if (immediate) {
        setOpening({ label, immediate: true });
        return;
      }
      showTimer.current = window.setTimeout(() => {
        if (coverActive.current) return;
        if (document.querySelector('[data-testid="signal-loader"]')) return;
        setOpening({ label, immediate: false });
      }, 250);
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
      window.clearTimeout(showTimer.current);
      setOpening(null);
    };
    const onReady = () => {
      window.clearTimeout(showTimer.current);
      setOpening(null);
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener(OPENING_EVENT, onOpening);
    window.addEventListener(TRANSITION_EVENT, onCover);
    window.addEventListener("reachout:ready", onReady);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.clearTimeout(showTimer.current);
      window.removeEventListener(OPENING_EVENT, onOpening);
      window.removeEventListener(TRANSITION_EVENT, onCover);
      window.removeEventListener("reachout:ready", onReady);
    };
  }, []);

  return opening ? <SignalLoader active label={opening.label} delay={0} /> : null;
}
