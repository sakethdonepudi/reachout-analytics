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
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, onScreen };
}

function CompanyTile({ logo, tone, eager }: { logo: ExperienceOrganisation; tone: "default" | "dark"; eager: boolean }) {
  return (
    <li className="company-marquee__item shrink-0">
      <div className={cn("company-tile group flex h-[74px] w-[184px] items-center gap-3 rounded-2xl border px-3.5 transition duration-300 hover:-translate-y-0.5 hover:border-saffron/35 sm:w-[204px]", tone === "dark" ? "border-white/10 bg-white/[.055] hover:bg-white/[.085]" : "border-border bg-card/75 hover:bg-elevated/70")}>
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-black/[.055] bg-[#fbfaf7] p-1.5">
          {/* Local SVG keeps the original brand colours and proportions. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo.src}
            alt={logo.alt}
            width={logo.width}
            height={logo.height}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
            className="h-auto max-h-full w-auto max-w-full object-contain"
            style={{ maxHeight: Math.min(logo.opticalHeight, 32) }}
          />
        </span>
        <span className={cn("min-w-0 font-display text-[13px] font-semibold leading-tight tracking-[-0.015em]", tone === "dark" ? "text-white" : "text-foreground")}>{logo.name}</span>
      </div>
    </li>
  );
}

function CompanyRow({ direction, items, tone, eager }: { direction: Direction; items: ExperienceOrganisation[]; tone: "default" | "dark"; eager: boolean }) {
  const duplicate = (
    <ul className="company-marquee__group" aria-hidden="true">
      {items.map((logo) => <CompanyTile key={`duplicate-${logo.name}`} logo={logo} tone={tone} eager={eager} />)}
    </ul>
  );

  return (
    <div className={cn("company-row", direction === "right" && "company-row--right")}>
      <div className="company-marquee__viewport">
        <div className={cn("company-marquee__track", direction === "left" ? "company-marquee__track--left" : "company-marquee__track--right")}>
          <ul className="company-marquee__group">
            {items.map((logo) => <CompanyTile key={logo.name} logo={logo} tone={tone} eager={eager} />)}
          </ul>
          {duplicate}
        </div>
      </div>
    </div>
  );
}

/**
 * Two restrained, opposite-direction company loops. The duplicate group is
 * hidden from assistive technology; keyboard focus pauses the motion, and
 * reduced-motion visitors receive a static readable grid.
 */
export default function CompanyExperience({ id, className, tone = "default" }: { id?: string; className?: string; tone?: "default" | "dark" }) {
  const { ref, onScreen } = useInView<HTMLElement>();
  const [hasEntered, setHasEntered] = useState(false);
  const rowOne = EXPERIENCE_ORGANISATIONS.filter((_, i) => i % 2 === 0);
  const rowTwo = EXPERIENCE_ORGANISATIONS.filter((_, i) => i % 2 === 1);
  const headingId = `${id ?? "company-experience"}-heading`;

  useEffect(() => {
    if (onScreen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) setHasEntered(true);
  }, [onScreen]);

  return (
    <section
      ref={ref}
      id={id}
      aria-labelledby={headingId}
      tabIndex={0}
      className={cn(
        "company-marquee pointer-events-auto relative z-10 scroll-mt-24 overflow-hidden border-t py-14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-saffron/35 sm:py-16",
        tone === "dark" ? "border-white/10 bg-[#050b1f]" : "border-border bg-background",
        onScreen && "is-live",
        className,
      )}
    >
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <h2 id={headingId} className={cn("font-display text-[clamp(24px,3vw,34px)] font-semibold tracking-[-0.025em]", tone === "dark" ? "text-white" : "text-foreground")}>Company experience</h2>
      </div>
      <div className="mt-7 space-y-2.5">
        <CompanyRow direction="left" items={rowOne} tone={tone} eager={hasEntered} />
        <CompanyRow direction="right" items={rowTwo} tone={tone} eager={hasEntered} />
      </div>
    </section>
  );
}
