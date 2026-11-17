"use client";

import { useEffect, useRef, useState } from "react";
import { EXPERIENCE_ORGANISATIONS, type ExperienceOrganisation } from "@/lib/experience";
import { cn } from "@/lib/utils";

type Direction = "left" | "right";

function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, onScreen };
}

function CompanyTile({ logo, eager, decorative = false }: { logo: ExperienceOrganisation; eager: boolean; decorative?: boolean }) {
  return (
    <li className="company-marquee__item">
      <div className="company-tile" tabIndex={decorative ? -1 : 0}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo.src}
          alt={logo.alt}
          width={logo.width}
          height={logo.height}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          className="company-logo"
          style={{ maxHeight: Math.min(logo.opticalHeight, 30) }}
        />
        <span className="sr-only">{logo.name}</span>
      </div>
    </li>
  );
}

function CompanyRow({ direction, items, eager, second = false }: { direction: Direction; items: ExperienceOrganisation[]; eager: boolean; second?: boolean }) {
  return (
    <div className={cn("company-row", direction === "right" && "company-row--right", second && "company-row--second")}>
      <div className="company-marquee__viewport">
        <div className={cn("company-marquee__track", direction === "left" ? "company-marquee__track--left" : "company-marquee__track--right")}>
          <ul className="company-marquee__group">
            {items.map((logo) => <CompanyTile key={logo.name} logo={logo} eager={eager} />)}
          </ul>
          <ul className="company-marquee__group" aria-hidden="true">
            {items.map((logo) => <CompanyTile key={`duplicate-${logo.name}`} logo={logo} eager={eager} decorative />)}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function CompanyExperience({ id, className }: { id?: string; className?: string }) {
  const { ref, onScreen } = useInView<HTMLElement>();
  const [hasEntered, setHasEntered] = useState(false);
  const rowOne = EXPERIENCE_ORGANISATIONS.filter((_, i) => i % 2 === 0);
  const rowTwo = EXPERIENCE_ORGANISATIONS.filter((_, i) => i % 2 === 1);
  const headingId = `${id ?? "company-experience"}-heading`;

  useEffect(() => {
    if (onScreen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) setHasEntered(true);
  }, [onScreen]);

  return (
    <section ref={ref} id={id} aria-labelledby={headingId} className={cn("company-marquee pointer-events-auto relative z-10 scroll-mt-24 overflow-hidden border-t border-[#EAEAEA] bg-white py-20 sm:py-24", onScreen && "is-live", className)}>
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <p className="company-eyebrow">Experience</p>
          <span className="rounded-full border border-[#EAEAEA] px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#6B6B6B]">Since 2023</span>
        </div>
        <h2 id={headingId} className="mt-2 font-display text-[clamp(30px,4vw,48px)] font-semibold tracking-[-0.03em] text-[#0B0B0C]">Company experience</h2>
        <p className="mt-2 text-[14px] text-[#6B6B6B]">Organisations our team has worked with.</p>
      </div>
      <div className="company-rows mt-10">
        <CompanyRow direction="left" items={rowOne} eager={hasEntered} />
        <CompanyRow direction="right" items={rowTwo} eager={false} second />
      </div>
    </section>
  );
}
