"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Logo } from "@/components/site/brand";
import { useNavigate } from "@/lib/use-navigate";

type Enroll = { secret: string; qr: string; account: string };

export default function EnrollClient() {
  const navigate = useNavigate();
  const [enroll, setEnroll] = useState<Enroll | null>(null);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [redirect, setRedirect] = useState("");

  useEffect(() => {
    void fetch("/api/account/totp", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || data.enabled) throw new Error(data.error ?? "Could not start enrollment");
        setEnroll({ secret: data.secret, qr: data.qr, account: data.account });
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not start enrollment"));
  }, []);

  async function confirm() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/account/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: digits.join(""), mode: "confirm" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "That code is not valid.");
      setCodes(data.recoveryCodes ?? []);
      setRedirect(data.redirect ?? "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "That code is not valid."); }
    finally { setBusy(false); }
  }

  return (
    <main className="grid min-h-[100svh] place-items-center bg-[var(--surface-canvas)] px-5 py-14 text-[var(--text-primary)]">
      <div className="w-full max-w-lg rounded-[var(--radius-panel)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] p-7 shadow-[var(--shadow-soft)]">
        <div className="flex justify-center"><Logo /></div>
        {!codes ? (
          <>
            <p className="type-micro mt-6 text-[var(--accent-brass)]">Two-factor authentication</p>
            <h1 className="type-h1 mt-2">Set up your authenticator</h1>
            <p className="type-small mt-2 text-[var(--text-muted)]">Install Google Authenticator or Microsoft Authenticator, then scan the QR code and enter the 6-digit code.</p>
            {error && <p role="alert" className="mt-4 rounded-[var(--radius-control)] border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-[12.5px] text-[var(--danger)]">{error}</p>}
            {enroll ? (
              <div className="mt-5 grid gap-5 sm:grid-cols-[200px_1fr] sm:items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={enroll.qr} alt="Authenticator QR code" width={200} height={200} className="rounded-xl border border-[var(--border-hairline)] bg-white p-2" />
                <div>
                  <p className="text-[12px] text-[var(--text-muted)]">Manual key</p>
                  <p className="mt-1 break-all rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-2 py-1.5 font-mono text-[12px]">{enroll.secret}</p>
                  <div className="mt-4">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">6-digit code</span>
                    <div className="mt-1 flex gap-1.5" onPaste={(event) => { event.preventDefault(); const clean = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split(""); setDigits(Array.from({ length: 6 }, (_v, i) => clean[i] ?? "")); }}>
                      {digits.map((digit, index) => (
                        <input key={index} value={digit} onChange={(event) => { const char = event.target.value.replace(/\D/g, "").slice(-1); setDigits((current) => current.map((item, i) => i === index ? char : item)); if (char) (event.target.nextElementSibling as HTMLInputElement | null)?.focus(); }} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} aria-label={`Digit ${index + 1}`} className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] text-center font-mono text-[17px] outline-none focus:border-[var(--accent-brass)]" />
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={() => void confirm()} disabled={busy || digits.join("").length !== 6} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent-brass)] text-[14px] font-semibold text-[var(--text-on-brass)] disabled:opacity-60">
                    {busy && <Loader2 className="size-4 animate-spin" />} Confirm
                  </button>
                </div>
              </div>
            ) : !error ? <p className="mt-6 flex items-center gap-2 text-[12px] text-[var(--text-muted)]"><Loader2 className="size-4 animate-spin" /> Loading…</p> : null}
          </>
        ) : (
          <>
            <p className="type-micro mt-6 text-[var(--accent-brass)]">Recovery codes</p>
            <h1 className="type-h1 mt-2">Save these codes now</h1>
            <p className="type-small mt-2 text-[var(--text-muted)]">Each code works once. They are shown only this once.</p>
            <ul className="mt-5 grid grid-cols-2 gap-2 font-mono text-[13px]">
              {codes.map((value) => <li key={value} className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2">{value}</li>)}
            </ul>
            <label className="mt-5 flex items-start gap-2 text-[12.5px]">
              <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} className="mt-0.5 size-4 accent-[var(--accent-brass)]" />
              I have saved these recovery codes somewhere safe.
            </label>
            <button type="button" disabled={!saved} onClick={() => navigate.replace(redirect || "/dashboard")} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent-brass)] text-[14px] font-semibold text-[var(--text-on-brass)] disabled:opacity-60">
              <Check className="size-4" /> Continue
            </button>
          </>
        )}
      </div>
    </main>
  );
}
