"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CASES, caseUrl } from "@/lib/cases";
import { POLITICAL_IDENTITIES } from "@/lib/parties";
import { PartyMark } from "@/components/site/party-mark";
import Reveal from "@/components/site/reveal";
import { cn } from "@/lib/utils";

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(to); return; }
    let raf = 0;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const start = performance.now();
      const dur = 1100;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <span ref={ref} className="tabular-nums">{n}{suffix}</span>;
}

export default function WorkShowcase() {
  const works = useMemo(() => CASES.filter((c) => c.party), []);

  return (
    <section id="work" className="pointer-events-auto relative scroll-mt-24 overflow-hidden bg-background py-20 sm:py-24">
      {/* ambient motion */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="animate-drift absolute -left-24 top-10 size-[420px] rounded-full bg-[radial-gradient(circle,rgba(245,138,36,.12),transparent_65%)] blur-2xl" />
        <div className="animate-drift absolute -right-20 bottom-0 size-[380px] rounded-full bg-[radial-gradient(circle,rgba(47,191,74,.10),transparent_65%)] blur-2xl [animation-delay:-6s]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 sm:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-saffron-2">Our work</p>
          <h2 className="mt-3 font-display text-[clamp(28px,3.6vw,46px)] font-semibold tracking-[-0.03em] text-foreground">
            Campaigns across India
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            Selected election programmes, with the state and party associations publicly reported. Shown for illustration only — no endorsement or ongoing client relationship is implied.
          </p>
        </Reveal>

        {/* animated stats */}
        <Reveal className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Party-state pairs", value: POLITICAL_IDENTITIES.length },
            { label: "Case studies", value: CASES.length },
            { label: "Districts mapped", value: 38 },
            { label: "Coverage", value: 6, suffix: "+" },
          ].map((s) => (
            <div key={s.label} className="glass rounded-2xl px-4 py-5 text-center">
              <p className="font-display text-3xl font-semibold text-foreground"><CountUp to={s.value} suffix={s.suffix} /></p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </Reveal>

        {/* authentic party symbols paired with their public state association */}
        <Reveal className="mt-12">
          <p className="mb-4 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Party symbols</p>
          <div className="flex flex-wrap items-start justify-center gap-4 sm:gap-6">
            {POLITICAL_IDENTITIES.map((identity) => (
              <div key={identity.id} className="flex min-w-[94px] flex-col items-center gap-2 text-center">
                <PartyMark party={identity.party} size="lg" />
                <span className="text-[11px] font-semibold leading-tight text-foreground">{identity.party}</span>
                <span className="text-[10.5px] leading-tight text-muted-foreground">{identity.state}</span>
              </div>
            ))}
          </div>
        </Reveal>

        {/* work cards */}
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {works.map((c, i) => {
            return (
              <Reveal key={c.slug} delay={i * 70}>
                <Link
                  href={caseUrl(c.slug)}
                  className="group glass flex h-full flex-col rounded-3xl p-5 transition-transform duration-300 hover:-translate-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-saffron/40 bg-saffron/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-saffron-2">
                      {c.badge}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <PartyMark party={c.party} size="md" />
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-semibold leading-tight text-foreground">{c.title}</h3>
                      <p className="truncate text-[12.5px] text-muted-foreground">{c.party} · {c.stateName}</p>
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{c.summary}</p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.tags.slice(0, 2).map((t, k) => (
                      <span key={t} className={cn("rounded-md px-2 py-1 text-[10.5px] font-semibold", k === 1 ? "bg-[#2fbf4a]/15 text-[#2fbf4a]" : "bg-elevated text-foreground/75")}>{t}</span>
                    ))}
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground">
                    View case study
                    <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-saffron to-[#e07617] text-[#241203] transition-transform group-hover:translate-x-0.5"><ArrowUpRight className="size-4" /></span>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
