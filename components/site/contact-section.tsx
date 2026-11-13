"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mail, Phone, MapPin, ArrowUpRight, CheckCircle2 } from "lucide-react";
import ShimmerButton from "@/components/ui/shimmer-button";
import dynamic from "next/dynamic";
import { Logo } from "@/components/site/brand";
import CompanyExperience from "@/components/site/company-marquee";
import { CONTACT } from "@/lib/cases";
import { rafLoop } from "@/lib/raf-loop";

const Globe = dynamic(() => import("@/components/site/globe"), { ssr: false });

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Last page. While it scrolls in, the 3D India map pulls away and a globe —
 * starting large and India-facing — shrinks into its place beside the contact
 * details and begins turning clockwise.
 */
export default function ContactSection() {
  const section = useRef<HTMLElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const flyer = useRef<HTMLDivElement>(null);
  const spin = useRef(0);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [globeReady, setGlobeReady] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setActive(true); setGlobeReady(true); }
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const s = section.current, sl = slot.current, fl = flyer.current;
      if (s && sl && fl) {
        const r = s.getBoundingClientRect();
        const p = clamp(1 - r.top / innerHeight, 0, 1); // 0 → section just below the fold, 1 → at the top
        const e = ease(clamp((p - 0.12) / 0.8, 0, 1));
        const end = sl.getBoundingClientRect();
        // Bound the decorative globe so it can never cover foreground content.
        const startSize = Math.min(Math.min(innerWidth, innerHeight) * 0.9, 640);
        const sx = innerWidth / 2 - startSize / 2, sy = innerHeight / 2 - startSize / 2;
        const size = startSize + (end.width - startSize) * e;
        const x = sx + (end.left - sx) * e, y = sy + (end.top - sy) * e;
        fl.style.width = fl.style.height = `${size}px`;
        fl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        const o = clamp((p - 0.18) / 0.32, 0, 1);
        fl.style.opacity = String(o);
        fl.style.visibility = o > 0.01 ? "visible" : "hidden";
        const fb = e < 0.98 ? `blur(${((1 - e) * 3).toFixed(0)}px)` : "none";
        if (fl.style.filter !== fb) fl.style.filter = fb;
        spin.current = o > 0.01 ? 0.15 + e * 0.85 : -1;
      }
    };
    return rafLoop(tick);
  }, [active]);

  const field =
    "w-full rounded-md border border-[var(--r-line)] bg-white px-4 py-2.5 text-base text-[var(--r-ink)] placeholder:text-[var(--r-muted)] outline-none focus:border-[var(--r-teal)] focus:ring-2 focus:ring-[var(--r-hl)]";
  const label = "mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--r-muted)]";

  return (
    <section
      ref={section}
      id="contact"
      className="pointer-events-auto relative z-[2] min-h-[100svh] overflow-hidden bg-[var(--r-bg)] px-6 pb-2 pt-36 text-[var(--r-ink)] scroll-mt-24 sm:px-10 lg:pb-10"
    >
      {/* flying globe (fixed, follows the slot) */}
      <div ref={flyer} className="pointer-events-none fixed left-0 top-0 z-[1] invisible will-change-transform" aria-hidden>
        <div className="absolute inset-[-10%] rounded-full bg-[radial-gradient(circle,rgba(29,158,117,.12),transparent_60%)] blur-2xl" />
        {globeReady ? <Globe className="relative size-full" speed={12} direction="clockwise" spinRef={spin} /> : <div className="size-full rounded-full border border-[var(--r-line)] bg-[var(--r-hl)]" aria-hidden />}
      </div>

      <div className="relative z-[2] mx-auto max-w-6xl">
        <div className="text-center">
          <span className="inline-flex rounded-full border border-teal/40 bg-[var(--r-hl)] px-4 py-1.5 text-sm font-medium text-[var(--r-teal-d)]">Contact</span>
          <h2 className="mt-6 font-display text-[clamp(44px,6vw,80px)] font-semibold tracking-[-0.035em]">
            Let&apos;s win your <span className="text-[var(--r-navy)] font-serif font-normal italic">next election</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-[var(--r-muted)]">
            Tell us about your campaign. Our strategy team will get back to you within one business day.
          </p>
        </div>

        <div className="mt-16 grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          {/* left */}
          <div>
            <h3 className="font-display text-2xl font-semibold">Get in touch</h3>
            <p className="mt-2 max-w-sm text-[var(--r-muted)]">Reach out via any channel below — or send a message and we&apos;ll call you back.</p>
            <ul className="mt-8 space-y-4">
              {[
                { icon: Mail, text: CONTACT.email, href: `mailto:${CONTACT.email}` },
                { icon: Phone, text: CONTACT.phone, href: `tel:${CONTACT.phone.replace(/\s/g, "")}` },
                { icon: MapPin, text: CONTACT.address },
              ].map(({ icon: Icon, text, href }) => (
                <li key={text} className="flex items-start gap-4 text-[var(--r-ink)]">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--r-line)] bg-white">
                    <Icon className="size-[18px] text-teal-deep" />
                  </span>
                  {href ? <a href={href} className="pt-2 hover:text-[var(--r-ink)]">{text}</a> : <span className="pt-2 leading-relaxed">{text}</span>}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex gap-2">
              {[["LinkedIn", CONTACT.linkedin], ["Instagram", CONTACT.instagram]].map(([name, href]) => (
                <a key={name} href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--r-line)] bg-white px-4 py-2 text-sm text-[var(--r-muted)] transition hover:border-[var(--r-teal)] hover:text-[var(--r-ink)]">
                  {name}<ArrowUpRight className="size-3.5" />
                </a>
              ))}
            </div>
            {/* the globe lands here */}
            <div ref={slot} className="mx-auto mt-4 aspect-square w-full max-w-[220px] lg:mx-0 lg:mt-2 lg:max-w-[180px]" />
          </div>

          {/* right: form */}
          <div className="relative report-card p-5 sm:p-7">
            
            <h3 className="font-display text-2xl font-semibold">Send a message</h3>
            <p className="mt-1.5 text-[var(--r-muted)]">Fill out the form and we&apos;ll get back to you promptly.</p>
            <div className="my-4 border-t border-dashed border-[var(--r-line)] sm:my-5" />
            {sent ? (
              <div className="flex flex-col items-center py-16 text-center">
                <CheckCircle2 className="size-12 text-[#1d9e75]" />
                <p className="mt-4 font-display text-xl font-semibold">Thank you — message received.</p>
                <p className="mt-1 text-[var(--r-muted)]">We&apos;ll be in touch within one business day.</p>
              </div>
            ) : (
              <form
                className="space-y-3 sm:space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (sending) return;
                  setSending(true);
                  setError("");
                  const f = new FormData(e.currentTarget);
                  try {
                    const res = await fetch("/api/contact", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: f.get("name"),
                        organisation: f.get("organisation"),
                        email: f.get("email"),
                        phone: f.get("phone"),
                        message: f.get("message"),
                        website: f.get("website"), // honeypot
                      }),
                    });
                    if (!res.ok) {
                      const d = await res.json().catch(() => ({}));
                      throw new Error(d.error || "Something went wrong");
                    }
                    setSent(true);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Something went wrong - please try again or email us.");
                  } finally {
                    setSending(false);
                  }
                }}
              >
                {/* honeypot: hidden from humans, bots fill it */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block"><span className={label}>Full name</span><input required name="name" className={field} placeholder="Your name" /></label>
                  <label className="block"><span className={label}>Party / organisation</span><input name="organisation" className={field} placeholder="Party or campaign" /></label>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block"><span className={label}>Email</span><input required type="email" name="email" className={field} placeholder="you@example.com" /></label>
                  <label className="block"><span className={label}>Phone</span><input type="tel" name="phone" className={field} placeholder="+91" /></label>
                </div>
                <label className="block"><span className={label}>Message</span><textarea name="message" rows={4} className={`${field} resize-none`} placeholder="Tell us about your constituency, timeline and goals" /></label>
                {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-200">{error}</p>}
                <ShimmerButton text={sending ? "Sending..." : "Send message"} duration={1.6} className="w-full border-teal/40 py-3.5  backdrop-blur-xl" />
              </form>
            )}
          </div>
        </div>

        <CompanyExperience className="mt-12" />

        <footer className="mt-2 flex flex-col items-center justify-between gap-4 border-t border-[var(--r-line)] pt-4 text-sm text-[var(--r-muted)] sm:flex-row">
          <div className="flex flex-wrap items-center gap-5"><Logo /><Link href="/services" className="hover:text-[var(--r-ink)]">Services</Link><Link href="/services/research-content" className="hover:text-[var(--r-ink)]">Research &amp; Content</Link></div>
          <span>© {new Date().getFullYear()} ReachOut Analytics Pvt. Ltd.</span>
        </footer>
      </div>
    </section>
  );
}
