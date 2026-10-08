"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, Phone, MapPin, ArrowUpRight, CheckCircle2 } from "lucide-react";
import ShimmerButton from "@/components/ui/shimmer-button";
import Globe from "@/components/site/globe";
import { Logo } from "@/components/site/navbar";
import { CONTACT } from "@/lib/cases";
import { rafLoop } from "@/lib/raf-loop";

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

  useEffect(() => {
    const tick = () => {
      const s = section.current, sl = slot.current, fl = flyer.current;
      if (s && sl && fl) {
        const r = s.getBoundingClientRect();
        const p = clamp(1 - r.top / innerHeight, 0, 1); // 0 → section just below the fold, 1 → at the top
        const e = ease(clamp((p - 0.12) / 0.8, 0, 1));
        const end = sl.getBoundingClientRect();
        const startSize = Math.min(innerWidth, innerHeight) * 1.7;
        const sx = innerWidth / 2 - startSize / 2, sy = innerHeight / 2 - startSize / 2;
        const size = startSize + (end.width - startSize) * e;
        const x = sx + (end.left - sx) * e, y = sy + (end.top - sy) * e;
        fl.style.width = fl.style.height = `${size}px`;
        fl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        const o = clamp((p - 0.08) / 0.3, 0, 1);
        fl.style.opacity = String(o);
        fl.style.visibility = o > 0.01 ? "visible" : "hidden";
        const fb = e < 0.98 ? `blur(${((1 - e) * 4).toFixed(0)}px)` : "none";
        if (fl.style.filter !== fb) fl.style.filter = fb;
        spin.current = o > 0.01 ? 0.15 + e * 0.85 : -1;
      }
    };
    return rafLoop(tick);
  }, []);

  const field =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[15px] text-white placeholder:text-white/30 outline-none transition focus:border-saffron/60 focus:bg-white/[0.07] focus:ring-4 focus:ring-saffron/10";
  const label = "mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45";

  return (
    <section
      ref={section}
      id="contact"
      className="pointer-events-auto relative z-[2] min-h-[100svh] overflow-hidden bg-[linear-gradient(180deg,rgba(5,11,31,0)_0%,rgba(5,11,31,.85)_18%,#050b1f_40%)] px-6 pb-2 pt-36 scroll-mt-24 sm:px-10 lg:pb-10"
    >
      {/* flying globe (fixed, follows the slot) */}
      <div ref={flyer} className="pointer-events-none fixed left-0 top-0 z-[1] invisible will-change-transform" aria-hidden>
        <div className="absolute inset-[-12%] rounded-full bg-[radial-gradient(circle,rgba(40,90,200,.35),transparent_62%)] blur-2xl" />
        <Globe className="relative size-full" speed={12} direction="clockwise" spinRef={spin} />
      </div>

      <div className="relative z-[2] mx-auto max-w-6xl">
        <div className="text-center">
          <span className="inline-flex rounded-full border border-saffron/40 bg-saffron/10 px-4 py-1.5 text-sm font-medium text-saffron-2">Contact</span>
          <h2 className="mt-6 font-display text-[clamp(44px,6vw,80px)] font-semibold tracking-[-0.035em]">
            Let&apos;s win your <span className="text-gradient-saffron font-serif font-normal italic">next election</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-white/60">
            Tell us about your campaign. Our strategy team will get back to you within one business day.
          </p>
        </div>

        <div className="mt-16 grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          {/* left */}
          <div>
            <h3 className="font-display text-2xl font-semibold">Get in touch</h3>
            <p className="mt-2 max-w-sm text-white/55">Reach out via any channel below — or send a message and we&apos;ll call you back.</p>
            <ul className="mt-8 space-y-4">
              {[
                { icon: Mail, text: CONTACT.email, href: `mailto:${CONTACT.email}` },
                { icon: Phone, text: CONTACT.phone, href: `tel:${CONTACT.phone.replace(/\s/g, "")}` },
                { icon: MapPin, text: CONTACT.address },
              ].map(({ icon: Icon, text, href }) => (
                <li key={text} className="flex items-start gap-4 text-white/80">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
                    <Icon className="size-[18px] text-saffron-2" />
                  </span>
                  {href ? <a href={href} className="pt-2 hover:text-white">{text}</a> : <span className="pt-2 leading-relaxed">{text}</span>}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex gap-2">
              {[["LinkedIn", CONTACT.linkedin], ["Instagram", CONTACT.instagram]].map(([name, href]) => (
                <a key={name} href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:border-white/25 hover:text-white">
                  {name}<ArrowUpRight className="size-3.5" />
                </a>
              ))}
            </div>
            {/* the globe lands here */}
            <div ref={slot} className="mx-auto mt-4 aspect-square w-full max-w-[220px] lg:mx-0 lg:mt-2 lg:max-w-[180px]" />
          </div>

          {/* right: form */}
          <div className="glass relative rounded-3xl p-5 sm:p-7">
            <span className="tricolor-line absolute inset-x-8 top-0 h-px opacity-70" aria-hidden />
            <h3 className="font-display text-2xl font-semibold">Send a message</h3>
            <p className="mt-1.5 text-white/55">Fill out the form and we&apos;ll get back to you promptly.</p>
            <div className="my-4 border-t border-dashed border-white/10 sm:my-5" />
            {sent ? (
              <div className="flex flex-col items-center py-16 text-center">
                <CheckCircle2 className="size-12 text-[#2fbf4a]" />
                <p className="mt-4 font-display text-xl font-semibold">Thank you — message received.</p>
                <p className="mt-1 text-white/55">We&apos;ll be in touch within one business day.</p>
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
                <ShimmerButton text={sending ? "Sending..." : "Send message"} duration={1.6} className="w-full border-saffron/40 py-3.5 dark:bg-[#0a1a44]/80 backdrop-blur-xl" />
              </form>
            )}
          </div>
        </div>

        <footer className="mt-2 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-4 text-sm text-white/40 sm:flex-row">
          <Logo />
          <span>© {new Date().getFullYear()} ReachOut Analytics Pvt. Ltd.</span>
        </footer>
      </div>
    </section>
  );
}
