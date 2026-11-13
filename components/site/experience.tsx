"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// three.js needs the browser, so the map is only rendered on the client.
const IndiaMap = dynamic(() => import("@/components/site/india-map"), { ssr: false });

/**
 * Mounts the WebGL map lazily: on the first real scroll, or after a short
 * idle delay. Keeps three.js off the critical path so the hero paints fast.
 */
export default function Experience() {
  const [mount, setMount] = useState(false);

  useEffect(() => {
    const mount = () => setMount(true);
    const onScroll = () => {
      if (window.scrollY > window.innerHeight * 0.15) mount();
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => { removeEventListener("scroll", onScroll); };
  }, []);

  return mount ? <IndiaMap /> : null;
}
