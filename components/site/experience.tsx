"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// three.js needs the browser, so the map is only rendered on the client.
const IndiaMap = dynamic(() => import("@/components/site/india-map"), { ssr: false });

/**
 * The map tour owns its own scroll length. The sticky stage keeps the canvas
 * pinned for one section only, so nothing map related can render over another
 * section. The WebGL map mounts lazily when the stage approaches the viewport.
 */
export default function Experience() {
  const sectionRef = useRef<HTMLElement>(null);
  const [mount, setMount] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setMount(true);
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} id="tour" className="pointer-events-auto relative h-[600vh] bg-white">
      <div className="sticky top-16 h-[calc(100svh-4rem)] overflow-hidden">
        {mount ? (
          <IndiaMap />
        ) : (
          <div
            className="absolute inset-0"
            aria-hidden
            style={{
              backgroundImage: "radial-gradient(circle, #CFCFCF 0.7px, transparent 0.9px)",
              backgroundSize: "24px 24px",
              maskImage: "linear-gradient(to bottom, transparent 0%, #000 30%)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 30%)",
            }}
          />
        )}
      </div>
    </section>
  );
}
