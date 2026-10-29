"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Mail, MapPin, Phone, Send } from "lucide-react";
import { CONTACT } from "@/lib/cases";
import { SERVICE_CATEGORIES } from "@/lib/services";
import { cn } from "@/lib/utils";

type State = { name: string; organisation: string; email: string; phone: string; service: string; requirement: string };
type CategoryGroup = { label: string; categories: readonly string[] };
type Props = { categories?: readonly string[]; groups?: CategoryGroup[]; showOrganisation?: boolean };

const EMPTY: State = { name: "", organisation: "", email: "", phone: "", service: "", requirement: "" };
const field = "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-saffron/60 focus:ring-4 focus:ring-saffron/10";
const label = "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";

export default function ServicesEnquiry({ categories = SERVICE_CATEGORIES, groups, showOrganisation = true }: Props) {
  const searchParams = useSearchParams();
  const requestedService = searchParams.get("service") ?? "";
  const categoryGroups = groups ?? (categories === SERVICE_CATEGORIES
    ? [{ label: "Political Intelligence", categories: SERVICE_CATEGORIES.slice(0, 6) }, { label: "Data & Business Analytics", categories: SERVICE_CATEGORIES.slice(6) }]
    : [{ label: "Service category", categories }]);
  const [values, setValues] = useState<State>(EMPTY);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const match = categories.find((s) => s === requestedService);
    if (match) setValues((v) => ({ ...v, service: match }));
  }, [requestedService, categories]);

  const selected = useMemo(() => categories.includes(values.service), [categories, values.service]);
  const change = (key: keyof State, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (error) setError("");
    if (sent) setSent(false);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    if (!values.name.trim() || !values.email.trim() || !selected || !values.requirement.trim()) {
      setError("Please complete your name, email, service category and project requirement.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          organisation: values.organisation.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          service: values.service,
          message: values.requirement.trim(),
          website: form.get("website"),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "We could not send your enquiry. Please try again or email us directly.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not send your enquiry. Please try again or email us directly.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-12">
      <div className="rounded-3xl border border-border bg-card/70 p-6 sm:p-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-saffron-2">Start a conversation</p>
        <h3 className="mt-3 font-display text-[clamp(22px,2.4vw,30px)] font-semibold tracking-[-0.02em]">
          Tell us what decision you need to make.
        </h3>
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
          Share the question, the data you have and the outcome you need. We will respond with a practical next step, not a sales pitch.
        </p>
        <ul className="mt-6 space-y-4 text-[13.5px] text-foreground/80">
          <li className="flex items-start gap-3"><Mail className="mt-0.5 size-4 shrink-0 text-saffron-2" /><a href={`mailto:${CONTACT.email}`} className="break-all hover:text-saffron-2">{CONTACT.email}</a></li>
          <li className="flex items-start gap-3"><Phone className="mt-0.5 size-4 shrink-0 text-saffron-2" /><a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`} className="hover:text-saffron-2">{CONTACT.phone}</a></li>
          <li className="flex items-start gap-3"><MapPin className="mt-0.5 size-4 shrink-0 text-saffron-2" /><span className="leading-relaxed">{CONTACT.address}</span></li>
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={CONTACT.linkedin} target="_blank" rel="noreferrer" className="rounded-full border border-border px-3 py-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground">LinkedIn</a>
          <a href={CONTACT.instagram} target="_blank" rel="noreferrer" className="rounded-full border border-border px-3 py-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground">Instagram</a>
        </div>
        <p className="mt-5 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
          We treat project data confidentially. Please do not send sensitive personal data in this initial enquiry.
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-[0_18px_50px_-34px_rgba(15,20,30,.5)] sm:p-7">
        {sent ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center text-center" role="status" aria-live="polite">
            <span className="grid size-14 place-items-center rounded-full bg-[#2fbf4a]/12 text-[#2fbf4a]"><CheckCircle2 className="size-7" /></span>
            <h3 className="mt-5 font-display text-2xl font-semibold">Enquiry received</h3>
            <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted-foreground">Thank you. We will review your requirement and get back to you using the contact details provided.</p>
            <button type="button" onClick={() => { setSent(false); setValues(EMPTY); }} className="mt-6 rounded-full border border-border px-4 py-2 text-[13px] font-semibold hover:bg-elevated">Send another enquiry</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={cn("block", !showOrganisation && "sm:col-span-2")}><span className={label}>Name *</span><input value={values.name} onChange={(e) => change("name", e.target.value)} required autoComplete="name" className={field} placeholder="Your name" aria-invalid={!values.name && !!error} /></label>
              {showOrganisation && <label className="block"><span className={label}>Organisation</span><input value={values.organisation} onChange={(e) => change("organisation", e.target.value)} autoComplete="organization" className={field} placeholder="Optional" /></label>}
              <label className="block"><span className={label}>Email *</span><input value={values.email} onChange={(e) => change("email", e.target.value)} required type="email" autoComplete="email" className={field} placeholder="you@organisation.com" aria-invalid={!values.email && !!error} /></label>
              <label className="block"><span className={label}>Phone</span><input value={values.phone} onChange={(e) => change("phone", e.target.value)} type="tel" autoComplete="tel" className={field} placeholder="Optional" /></label>
            </div>
            <label className="mt-4 block">
              <span className={label}>Service category *</span>
              <select value={values.service} onChange={(e) => change("service", e.target.value)} required className={field} aria-invalid={!selected && !!error}>
                <option value="">Select a service area</option>
                {categoryGroups.map((group) => <optgroup key={group.label} label={group.label}>{group.categories.map((s) => <option key={s} value={s}>{s}</option>)}</optgroup>)}
              </select>
            </label>
            <label className="mt-4 block">
              <span className={label}>Project requirement *</span>
              <textarea value={values.requirement} onChange={(e) => change("requirement", e.target.value)} required rows={6} className={cn(field, "resize-y")} placeholder="What are you trying to understand, improve or decide? Include timeline, geography and available data if relevant." aria-invalid={!values.requirement && !!error} />
            </label>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-rose-700 dark:text-rose-300"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</p>}
            <div className="mt-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-[10.5px] text-muted-foreground">Fields marked * are required. Your details are used only to respond to this enquiry.</p>
              <button type="submit" disabled={sending} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-saffron px-5 py-3 text-[13px] font-semibold text-[#241203] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {sending ? "Sending…" : "Send enquiry"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
