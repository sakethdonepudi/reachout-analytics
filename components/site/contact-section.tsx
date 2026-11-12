"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/site/brand";
import { CONTACT } from "@/lib/cases";

const field = "mt-1 min-h-10 w-full rounded-md border border-[var(--r-line)] bg-white px-3 text-[13.5px] text-[var(--r-ink)] outline-none focus:border-[var(--r-teal)] focus:ring-2 focus:ring-[var(--r-hl)]";
const label = "text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--r-muted)]";

export default function ContactSection() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  return (
    <section id="contact" className="report-section scroll-mt-20">
      <div className="report-wrap py-6">
        <h2 className="report-heading">Contact</h2>
        <p className="report-sub">Tell us about the decision, data or campaign you need help with.</p>

        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="report-card p-5">
            <h3 className="text-[16px] font-semibold text-[var(--r-navy)]">Get in touch</h3>
            <ul className="mt-4 space-y-3 text-[13px] text-[var(--r-muted)]">
              <li className="flex items-start gap-2"><Mail className="mt-0.5 size-4 shrink-0 text-[var(--r-teal)]" /><a className="report-link" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></li>
              <li className="flex items-start gap-2"><Phone className="mt-0.5 size-4 shrink-0 text-[var(--r-teal)]" /><a className="report-link" href={`tel:${CONTACT.phone.replace(/\s/g, "")}`}>{CONTACT.phone}</a></li>
              <li className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-[var(--r-teal)]" /><span>{CONTACT.address}</span></li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-3 border-t border-[var(--r-line)] pt-4 text-[12.5px]">
              <a className="report-link" href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>
              <a className="report-link" href={CONTACT.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
            </div>
          </div>

          <div className="report-card p-5">
            {sent ? (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <CheckCircle2 className="size-10 text-[var(--r-teal)]" />
                <p className="mt-3 text-[16px] font-semibold text-[var(--r-navy)]">Thank you. Message received.</p>
                <p className="mt-1 text-[13px] text-[var(--r-muted)]">We will be in touch within one business day.</p>
              </div>
            ) : (
              <form
                className="space-y-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (sending) return;
                  setSending(true);
                  setError("");
                  const form = new FormData(event.currentTarget);
                  try {
                    const response = await fetch("/api/contact", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: form.get("name"),
                        organisation: form.get("organisation"),
                        email: form.get("email"),
                        phone: form.get("phone"),
                        message: form.get("message"),
                        website: form.get("website"),
                      }),
                    });
                    if (!response.ok) {
                      const body = await response.json().catch(() => ({}));
                      throw new Error(body.error || "Something went wrong");
                    }
                    setSent(true);
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again or email us.");
                  } finally {
                    setSending(false);
                  }
                }}
              >
                <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block"><span className={label}>Full name</span><input required name="name" className={field} placeholder="Your name" /></label>
                  <label className="block"><span className={label}>Party or organisation</span><input name="organisation" className={field} placeholder="Party or campaign" /></label>
                  <label className="block"><span className={label}>Email</span><input required type="email" name="email" className={field} placeholder="you@example.com" /></label>
                  <label className="block"><span className={label}>Phone</span><input type="tel" name="phone" className={field} placeholder="+91" /></label>
                </div>
                <label className="block"><span className={label}>Message</span><textarea name="message" rows={4} className={field} placeholder="Constituency, timeline and goals" /></label>
                {error && <p role="alert" className="rounded-md border border-[var(--r-coral)]/40 bg-[#fdf0eb] px-3 py-2 text-[12.5px] text-[var(--r-coral)]">{error}</p>}
                <button type="submit" disabled={sending} className="report-btn w-full disabled:opacity-60">{sending ? "Sending..." : "Send message"}</button>
              </form>
            )}
          </div>
        </div>

        <footer className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-[var(--r-line)] pt-5 text-[12px] text-[var(--r-muted)] sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-4">
            <Logo />
            <Link href="/services" className="hover:text-[var(--r-navy)]">Services</Link>
            <Link href="/services/research-content" className="hover:text-[var(--r-navy)]">Research and Content</Link>
            <Link href="/about" className="hover:text-[var(--r-navy)]">About Us</Link>
          </div>
          <span>© {new Date().getFullYear()} ReachOut Analytics Pvt. Ltd.</span>
        </footer>
      </div>
    </section>
  );
}
