"use client";

import { useCallback, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import Turnstile from "@/components/site/turnstile";
import { passwordStrength } from "@/lib/password-policy";

const STRENGTH = ["", "Weak", "Fair", "Good", "Strong"];

export default function PasswordClient({ first, turnstileEnabled, nonce }: { first: boolean; turnstileEnabled: boolean; nonce?: string }) {
  const [form, setForm] = useState({ current: "", password: "", confirm: "" });
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
  const onVerify = useCallback((value: string) => setToken(value), []);
  const strength = passwordStrength(form.password);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("The passwords do not match."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, turnstileToken: token }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.redirect) { window.location.assign(data.redirect); return; }
      if (response.ok) { window.location.assign("/dashboard"); return; }
      setError(typeof data.error === "string" ? data.error : "Could not change the password.");
      if (turnstileEnabled) setResetNonce((value) => value + 1);
    } catch { setError("Could not change the password."); }
    finally { setBusy(false); }
  }

  return (
    <main className="grid min-h-[100svh] place-items-center bg-[var(--surface-canvas)] px-5 py-14 text-[var(--text-primary)]">
      <div className="w-full max-w-md rounded-[var(--radius-panel)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] p-7 shadow-[var(--shadow-soft)]">
        <p className="type-micro text-[var(--accent-brass)]">Account</p>
        <h1 className="type-h1 mt-2">{first ? "Choose your password" : "Change password"}</h1>
        <p className="type-small mt-2 text-[var(--text-muted)]">Use at least 12 characters. Do not reuse a password from another site.</p>
        {error && <p role="alert" className="mt-4 rounded-[var(--radius-control)] border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-[12.5px] text-[var(--danger)]">{error}</p>}
        <form onSubmit={submit} className="mt-5 space-y-3">
          {!first && <Field label="Current password" type="password" value={form.current} onChange={(value) => setForm((current) => ({ ...current, current: value }))} autoComplete="current-password" />}
          <div>
            <Field label="New password" type="password" value={form.password} onChange={(value) => setForm((current) => ({ ...current, password: value }))} autoComplete="new-password" />
            <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-raised)]"><span className="block h-full rounded-full bg-[var(--accent-brass)]" style={{ width: `${strength * 25}%` }} /></span>
              <span>{STRENGTH[strength]}</span>
            </div>
          </div>
          <Field label="Confirm new password" type="password" value={form.confirm} onChange={(value) => setForm((current) => ({ ...current, confirm: value }))} autoComplete="new-password" />
          {turnstileEnabled && <div className="flex justify-center"><Turnstile onVerify={onVerify} theme="light" resetNonce={resetNonce} nonce={nonce} action="password" /></div>}
          <button type="submit" disabled={busy || (turnstileEnabled && !token)} className="report-btn w-full disabled:opacity-60">
            {busy && <Loader2 className="size-4 animate-spin" />} Save password
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type = "text", autoComplete }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} required className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 text-[14px] outline-none focus:border-[var(--accent-brass)] focus:ring-2 focus:ring-[var(--accent-brass)]/25" />
    </label>
  );
}
