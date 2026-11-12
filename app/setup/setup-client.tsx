"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/site/brand";
import Turnstile from "@/components/site/turnstile";
import { passwordStrength } from "@/lib/password-policy";

const STRENGTH = ["", "Weak", "Fair", "Good", "Strong"];

export default function SetupClient({ turnstileEnabled, nonce }: { turnstileEnabled: boolean; nonce?: string }) {
  const [form, setForm] = useState({ setupToken: "", username: "", displayName: "", password: "", confirm: "" });
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
  const strength = passwordStrength(form.password);
  const onVerify = useCallback((value: string) => setToken(value), []);

  function set(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("The passwords do not match."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, turnstileToken: token }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.redirect) { window.location.assign(data.redirect); return; }
      setError(typeof data.error === "string" ? data.error : "Setup failed.");
      if (turnstileEnabled) setResetNonce((value) => value + 1);
    } catch { setError("Setup failed."); }
    finally { setBusy(false); }
  }

  return (
    <main className="relative grid min-h-[100svh] place-items-center bg-[var(--surface-canvas)] px-5 py-14 text-[var(--text-primary)]">
      <div className="absolute right-5 top-5"></div>
      <div className="w-full max-w-md">
        <div className="mb-7 flex justify-center"><Logo /></div>
        <div className="report-card p-7">
          <p className="type-micro text-[var(--r-teal-d)]">One-time setup</p>
          <h1 className="type-h1 mt-2">Create the first owner</h1>
          <p className="type-small mt-2 text-[var(--text-muted)]">This page stops working after the first owner exists.</p>
          {error && <p role="alert" className="mt-4 rounded-[var(--radius-control)] border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-[12.5px] text-[var(--danger)]">{error}</p>}
          <form onSubmit={submit} className="mt-5 space-y-3">
            <Field label="Setup token" type="password" value={form.setupToken} onChange={(value) => set("setupToken", value)} autoComplete="off" />
            <Field label="Username" value={form.username} onChange={(value) => set("username", value)} autoComplete="username" hint="3-32 characters: a-z, 0-9, dot, underscore, hyphen" />
            <Field label="Display name" value={form.displayName} onChange={(value) => set("displayName", value)} autoComplete="name" />
            <div>
              <Field label="Password" type="password" value={form.password} onChange={(value) => set("password", value)} autoComplete="new-password" />
              <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-raised)]"><span className="block h-full rounded-full bg-[var(--accent-brass)]" style={{ width: `${strength * 25}%` }} /></span>
                <span>{STRENGTH[strength]}</span>
              </div>
            </div>
            <Field label="Confirm password" type="password" value={form.confirm} onChange={(value) => set("confirm", value)} autoComplete="new-password" />
            {turnstileEnabled && <div className="flex justify-center"><Turnstile onVerify={onVerify} theme="light" resetNonce={resetNonce} nonce={nonce} action="setup" /></div>}
            <button type="submit" disabled={busy || (turnstileEnabled && !token)} className="report-btn w-full disabled:opacity-60">
              {busy && <Loader2 className="size-4 animate-spin" />} Create owner
            </button>
          </form>
          <div className="mt-5 text-center text-[12px] text-[var(--text-muted)]"><Link href="/" className="hover:text-[var(--text-primary)]">Back to site</Link></div>
        </div>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type = "text", autoComplete, hint }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} required className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 text-[14px] outline-none focus:border-[var(--accent-brass)] focus:ring-2 focus:ring-[var(--accent-brass)]/25" />
      {hint && <span className="mt-1 block text-[10.5px] text-[var(--text-muted)]">{hint}</span>}
    </label>
  );
}
