import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, GraduationCap, LineChart, Cpu, Presentation } from "lucide-react";
import Navbar from "@/components/site/navbar";
import Reveal from "@/components/site/reveal";
import { getAbout } from "@/lib/about-content";

export const metadata: Metadata = {
  title: "About Us — ReachOut Analytics",
  description:
    "ReachOut Analytics brings together data science, practical research and professional education to help organisations make informed decisions and develop analytical capability.",
};

// Content is stored in MongoDB and may change from the admin portal.
export const dynamic = "force-dynamic";

const EXPERTISE_ICONS = [LineChart, Cpu, GraduationCap];

export default async function AboutPage() {
  const c = await getAbout();
  const bioHeadings = ["Background and qualifications", "Applied industry experience", "Training and research"];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background text-foreground">
        {/* hero */}
        <section className="relative overflow-hidden pt-32">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="animate-drift absolute -left-24 top-10 size-[420px] rounded-full bg-[radial-gradient(circle,rgba(245,138,36,.10),transparent_65%)] blur-2xl" />
            <div className="animate-drift absolute -right-24 top-40 size-[380px] rounded-full bg-[radial-gradient(circle,rgba(47,191,74,.08),transparent_65%)] blur-2xl [animation-delay:-6s]" />
          </div>
          <div className="relative mx-auto max-w-6xl px-6 sm:px-10">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <Link href="/" className="hover:text-foreground">Home</Link>
              <span aria-hidden>/</span>
              <span className="font-medium text-foreground/80">About Us</span>
            </nav>

            <Reveal className="mt-10 max-w-3xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-saffron-2">{c.eyebrow}</p>
              <h1 className="mt-4 font-display text-[clamp(32px,4.6vw,60px)] font-semibold leading-[1.02] tracking-[-0.03em]">{c.headline}</h1>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{c.intro}</p>
            </Reveal>
          </div>
        </section>

        {/* company overview */}
        <section className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
          <Reveal className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
            <h2 className="font-display text-[clamp(24px,3vw,36px)] font-semibold tracking-[-0.02em]">Our approach</h2>
            <div className="max-w-xl space-y-5 text-[16px] leading-relaxed text-foreground/80">
              {c.overview.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </Reveal>

          {/* expertise */}
          <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-3">
            {c.expertise.map((e, i) => {
              const Icon = EXPERTISE_ICONS[i % EXPERTISE_ICONS.length];
              return (
                <Reveal key={e.title} delay={i * 80} className="bg-card p-6">
                  <span className="grid size-10 place-items-center rounded-xl border border-border bg-elevated text-saffron-2"><Icon className="size-5" /></span>
                  <h3 className="mt-4 font-display text-lg font-semibold">{e.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{e.desc}</p>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* core team */}
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
            <Reveal>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-saffron-2">Our Core Team</p>
              <h2 className="mt-3 font-display text-[clamp(26px,3.2vw,40px)] font-semibold tracking-[-0.02em]">{c.team.name}</h2>
              <p className="mt-1 text-[15px] text-muted-foreground">{c.team.role}</p>
            </Reveal>

            <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(260px,360px)_1fr] lg:gap-14">
              <Reveal className="mx-auto w-full max-w-[360px] lg:mx-0">
                <div className="overflow-hidden rounded-3xl border border-border bg-elevated">
                  <Image src={c.team.portrait} alt={c.team.portraitAlt} width={800} height={800} className="h-auto w-full object-cover" sizes="(max-width: 1024px) 80vw, 360px" priority />
                </div>
              </Reveal>

              <div className="space-y-7">
                {c.team.bio.map((p, i) => (
                  <Reveal key={i} delay={i * 70}>
                    <h3 className="font-display text-[15px] font-semibold text-foreground">{bioHeadings[i] ?? ""}</h3>
                    <p className="mt-2 max-w-2xl text-[16px] leading-relaxed text-foreground/80">{p}</p>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* experience, training, skills */}
        <section className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
          <div className="grid gap-12 lg:grid-cols-3">
            <Reveal>
              <h2 className="font-display text-xl font-semibold">Professional experience</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{c.professionalOrgs.join(" · ")}</p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="font-display text-xl font-semibold">Training delivered for</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{c.trainingOrgs.join(" · ")}</p>
            </Reveal>
            <Reveal delay={160}>
              <h2 className="font-display text-xl font-semibold">Technical skills</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {c.skills.map((s) => (
                  <li key={s} className="rounded-full border border-border bg-card px-3 py-1 text-[12.5px] font-medium text-foreground/80">{s}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* closing CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-24 sm:px-10">
          <Reveal className="glass flex flex-col items-start justify-between gap-6 rounded-3xl p-8 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-[clamp(22px,2.6vw,32px)] font-semibold tracking-[-0.02em]">{c.cta.title}</h2>
              <p className="mt-2 text-[15px] text-muted-foreground">{c.cta.body}</p>
            </div>
            <Link href="/#contact" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-saffron px-6 py-3.5 text-[15px] font-semibold text-[#241203] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50">
              {c.cta.button} <ArrowRight className="size-4" />
            </Link>
          </Reveal>
        </section>

        <footer className="border-t border-border py-8 text-center text-[13px] text-muted-foreground">
          © {new Date().getFullYear()} ReachOut Analytics Pvt. Ltd.
        </footer>
      </main>
    </>
  );
}
