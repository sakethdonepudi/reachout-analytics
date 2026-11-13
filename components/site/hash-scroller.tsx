"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Scrolls to an in-page hash after the destination route has painted. */
export default function HashScroller() {
  const pathname = usePathname();

  useEffect(() => {
    let frame = 0;
    let attempts = 0;

    const scroll = () => {
      const hash = window.location.hash;
      if (!hash || hash === "#") return;
      let id = hash.slice(1);
      try { id = decodeURIComponent(id); } catch { /* use the raw hash */ }
      const target = document.getElementById(id);
      if (!target) {
        if (attempts++ < 60) frame = requestAnimationFrame(scroll);
        return;
      }
      target.scrollIntoView({ behavior: "auto", block: "start" });
    };

    scroll();
    const onHash = () => { attempts = 0; scroll(); };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      let url: URL;
      try { url = new URL(anchor.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin || !url.hash) return;
      if (url.pathname !== window.location.pathname) return;
      window.setTimeout(() => { attempts = 0; scroll(); }, 80);
    };
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
    };
  }, [pathname]);

  return null;
}
