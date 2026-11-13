"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { Logo } from "@/components/site/brand";
import Turnstile from "@/components/site/turnstile";
import { cn } from "@/lib/utils";
import { useNavigate } from "@/lib/use-navigate";
import { useDelayedFlag } from "@/lib/use-delayed-flag";
import { shakeElement } from "@/lib/shake";

function LoginClient({ turnstileEnabled, nonce }: { turnstileEnabled: boolean; nonce?: string }) {
  const search = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<"password" | "totp">("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(0);
  const [success, setSuccess] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [recovery, setRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedCode = useRef("");
  const showSpinner = useDelayedFlag(loading);
  const onVerify = useCallback((value: string) => setToken(value), []);
  const next = search.get("next") ?? "";
  const idle = search.get("reason") === "idle";

  function startOpening(redirect: string) {
    setSuccess(true);
    window.setTimeout(() => navigate.replace(redirect), 280);
  }

  function updateCapsLock(event: React.KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState("CapsLock"));
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (turnstileEnabled && !token) { setError("Complete the CAPTCHA to continue."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password, next, turnstileToken: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.redirect === "string") { startOpening(data.redirect); return; }
      if (res.ok && data.step === "totp") { setStep("totp"); setToken(""); setResetNonce((value) => value + 1); return; }
      setError(res.status === 401 ? "Incorrect username or password" : typeof data.error === "string" ? data.error : "Sign-in failed. Please try again.");
      shakeElement(formRef.current);
      setShake((value) => value + 1); setPassword("");
      if (turnstileEnabled) setResetNonce((value) => value + 1);
    } catch { setError("Sign-in failed. Please try again."); shakeElement(formRef.current); setShake((value) => value + 1); }
    finally { setLoading(false); }
  }

  function setDigit(index: number, value: string) {
    const char = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => current.map((item, i) => i === index ? char : item));
    if (char && index < 5) inputs.current[index + 1]?.focus();
  }

  function pasteDigits(value: string) {
    const clean = value.replace(/\D/g, "").slice(0, 6).split("");
    setDigits(Array.from({ length: 6 }, (_item, index) => clean[index] ?? ""));
    inputs.current[Math.min(clean.length, 5)]?.focus();
  }

  async function submitCode() {
    if (turnstileEnabled && !token) { setError("Complete the CAPTCHA to continue."); return; }
    setLoading(true); setError("");
    try {
      const code = recovery ? "" : digits.join("");
      const res = await fetch("/api/auth/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, recoveryCode: recovery ? recoveryCode : undefined, turnstileToken: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.redirect === "string") { startOpening(data.redirect); return; }
      setError(res.status === 401 ? "That code is not valid" : typeof data.error === "string" ? data.error : "Verification failed.");
      submittedCode.current = "";
      shakeElement(formRef.current); setShake((value) => value + 1); setDigits(Array(6).fill(""));
      if (turnstileEnabled) setResetNonce((value) => value + 1);
    } catch { submittedCode.current = ""; setError("Verification failed."); shakeElement(formRef.current); setShake((value) => value + 1); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const code = digits.join("");
    if (step !== "totp" || recovery || code.length !== 6 || loading) return;
    if (submittedCode.current === code) return;
    submittedCode.current = code;
    void submitCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits, step, recovery, loading]);

  return (
    <>
      <main className="grid min-h-[100svh] place-items-center bg-[var(--r-bg)] px-5 py-14 text-[var(--r-ink)]">
      <div className="relative w-full max-w-sm">
        <div className="mb-7 flex justify-center"><Logo /></div>
        <div className="report-card p-7">
          <p className="type-micro text-[var(--r-teal-d)]">Secure access</p>
          <h1 className="type-h1 mt-2">{step === "totp" ? "Enter your code" : "Sign in"}</h1>
          <p className="type-small mt-2 text-[var(--text-muted)]">
            {step === "totp" ? `Open your authenticator app for ${username}.` : "Use your workspace username and password."}
          </p>

          {idle && step === "password" && (
            <p role="status" className="mt-4 rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] px-3 py-2 text-[12.5px] text-[var(--text-muted)]">Signed out after 10 minutes of inactivity.</p>
          )}

          {error && (
            <p role="alert" className={cn("mt-5 rounded-[var(--radius-control)] border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-[12.5px] text-[var(--danger)]", shake > 0 && "login-shake")} key={shake}>
              {error}
            </p>
          )}

          {step === "password" ? (
            <form ref={formRef} onSubmit={signIn} className="mt-5 space-y-3">
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Username</span>
                <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus required className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3.5 text-[14px] outline-none focus:border-[var(--accent-brass)] focus:ring-2 focus:ring-[var(--accent-brass)]/25" />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Password</span>
                <div className="relative mt-1">
                  <input type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={updateCapsLock} onKeyUp={updateCapsLock} className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3.5 pr-12 text-[14px] outline-none focus:border-[var(--accent-brass)] focus:ring-2 focus:ring-[var(--accent-brass)]/25" />
                  <button type="button" onClick={() => setShow((value) => !value)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-0.5 top-0.5 grid size-10 place-items-center rounded-[var(--radius-control)] text-[var(--text-muted)] hover:bg-[var(--surface-raised)]">
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </label>
              {capsLock && <p className="text-[11.5px] text-[var(--warning)]">Caps Lock is on.</p>}
              {turnstileEnabled && <div className="flex justify-center"><Turnstile onVerify={onVerify} theme="light" resetNonce={resetNonce} nonce={nonce} action="login" /></div>}
              <button type="submit" disabled={loading || success || (turnstileEnabled && !token)} className="report-btn w-full disabled:opacity-60">
                {success ? <Check className="success-pop size-4" /> : showSpinner ? <Loader2 className="size-4 animate-spin" /> : null} Continue
              </button>
            </form>
          ) : (
            <form ref={formRef} onSubmit={(event) => { event.preventDefault(); submittedCode.current = ""; void submitCode(); }} className="mt-5 space-y-3">
              {!recovery ? (
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">6-digit code</span>
                  <div className="mt-1 flex gap-2" onPaste={(event) => { event.preventDefault(); pasteDigits(event.clipboardData.getData("text")); }}>
                    {digits.map((digit, index) => (
                      <input key={index} ref={(node) => { inputs.current[index] = node; }} value={digit} onChange={(event) => setDigit(index, event.target.value)} onKeyDown={(event) => { if (event.key === "Backspace" && !digits[index] && index > 0) inputs.current[index - 1]?.focus(); }} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} aria-label={`Digit ${index + 1}`} className="min-h-12 w-full rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] text-center font-mono text-[18px] outline-none focus:border-[var(--accent-brass)]" />
                    ))}
                  </div>
                </div>
              ) : (
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Recovery code</span>
                  <input value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} autoComplete="off" className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 font-mono text-[14px] outline-none focus:border-[var(--accent-brass)]" />
                </label>
              )}
              {turnstileEnabled && <div className="flex justify-center"><Turnstile onVerify={onVerify} theme="light" resetNonce={resetNonce} nonce={nonce} action="totp" /></div>}
              <button type="submit" disabled={loading || success || (turnstileEnabled && !token) || (!recovery && digits.join("").length !== 6)} className="report-btn w-full disabled:opacity-60">
                {success ? <Check className="success-pop size-4" /> : showSpinner ? <Loader2 className="size-4 animate-spin" /> : null} Verify
              </button>
              <button type="button" onClick={() => { setRecovery((value) => !value); setError(""); }} className="w-full text-center text-[12px] font-semibold text-[var(--r-teal-d)] underline decoration-dotted underline-offset-4">
                {recovery ? "Use an authenticator code" : "Use a recovery code"}
              </button>
              <button type="button" onClick={() => { setStep("password"); setError(""); setRecovery(false); }} className="w-full text-center text-[12px] text-[var(--text-muted)]">Back to password</button>
              {/timed out/i.test(error) && <a href="/login" className="block text-center text-[12px] font-semibold text-[var(--r-teal-d)] underline decoration-dotted underline-offset-4">Sign in again</a>}
            </form>
          )}

          <div className="mt-5 flex items-center justify-between text-[12px] text-[var(--text-muted)]">
            <Link href="/" className="footer-link hover:text-[var(--text-primary)]">Back to site</Link>
            <Link href="/setup" className="footer-link hover:text-[var(--text-primary)]">First setup</Link>
          </div>
        </div>
      </div>
      </main>
    </>
  );
}

export default function LoginPageClient(props: { turnstileEnabled: boolean; nonce?: string }) {
  return (
    <Suspense fallback={<main className="grid min-h-[100svh] place-items-center bg-[var(--surface-canvas)] text-sm text-[var(--text-muted)]">Loading sign in…</main>}>
      <LoginClient {...props} />
    </Suspense>
  );
}
