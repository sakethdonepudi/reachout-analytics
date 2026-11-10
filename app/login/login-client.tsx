"use client";

import { Suspense, useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Logo } from "@/components/site/navbar";
import ThemeToggle from "@/components/site/theme-toggle";
import Turnstile from "@/components/site/turnstile";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

function LoginClient({ turnstileEnabled, nonce }: { turnstileEnabled: boolean; nonce?: string }) {
  const { theme } = useTheme();
  const search = useSearchParams();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(0);
  const [resetNonce, setResetNonce] = useState(0);
  const onVerify = useCallback((value: string) => setToken(value), []);
  const next = search.get("next") ?? "";

  function updateCapsLock(event: React.KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState("CapsLock"));
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (turnstileEnabled && !token) {
      setError("Complete the CAPTCHA to continue.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, next, turnstileToken: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.redirect === "string") {
        window.location.assign(data.redirect);
        return;
      }
      setError(
        res.status === 401
          ? "Incorrect password"
          : typeof data.error === "string"
            ? data.error
            : "Sign-in failed. Please try again.",
      );
      setShake((value) => value + 1);
      setPassword("");
      if (turnstileEnabled) setResetNonce((value) => value + 1);
    } catch {
      setError("Sign-in failed. Please try again.");
      setShake((value) => value + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative grid min-h-[100svh] place-items-center overflow-hidden bg-[var(--surface-canvas)] px-5 py-14 text-[var(--text-primary)]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Image
          src="/images/hero/slide-1-1672.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[72%_50%] opacity-30 dark:opacity-20"
        />
        <div className="absolute inset-0 bg-[var(--surface-canvas)]/78 dark:bg-[#070b12]/72" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--surface-canvas)]/20 to-[var(--surface-canvas)]" />
        <div className="absolute -left-32 top-1/4 size-96 rounded-full bg-[radial-gradient(circle,rgba(245,138,36,.14),transparent_68%)] blur-3xl" />
      </div>

      <div className="absolute right-5 top-5 z-10"><ThemeToggle /></div>

      <div className="relative w-full max-w-sm">
        <div className="mb-7 flex justify-center"><Logo /></div>
        <div className="rounded-[var(--radius-panel)] border border-[var(--border-hairline)] bg-[var(--surface-panel)]/95 p-7 shadow-[var(--shadow-soft)] backdrop-blur-xl">
          <p className="type-micro text-[var(--accent-brass)]">Secure access</p>
          <h1 className="type-h1 mt-2 text-[var(--text-primary)]">Sign in</h1>
          <p className="type-small mt-2 text-[var(--text-muted)]">Enter your workspace password to continue.</p>

          {error && (
            <p role="alert" className={cn("mt-5 rounded-[var(--radius-control)] border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-[12.5px] text-[var(--danger)]", shake > 0 && "login-shake")} key={shake}>
              {error}
            </p>
          )}

          <form onSubmit={signIn} className="mt-5 space-y-3">
            <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Password</label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={updateCapsLock}
                onKeyUp={updateCapsLock}
                className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3.5 pr-12 text-[14px] text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-brass)] focus:ring-2 focus:ring-[var(--accent-brass)]/25"
              />
              <button
                type="button"
                onClick={() => setShow((value) => !value)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-1 top-1 grid size-9 place-items-center rounded-[var(--radius-control)] text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brass)]"
              >
                {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
            {capsLock && <p className="text-[11.5px] text-[var(--warning)]">Caps Lock is on.</p>}

            {turnstileEnabled && (
              <div className="flex justify-center">
                <Turnstile onVerify={onVerify} theme={theme} resetNonce={resetNonce} nonce={nonce} />
              </div>
            )}
            {turnstileEnabled && !token && (
              <p className="text-center text-[12px] text-[var(--text-muted)]">Complete the CAPTCHA to enable sign in.</p>
            )}

            <button
              type="submit"
              disabled={loading || (turnstileEnabled && !token)}
              className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-[var(--radius-control)] bg-[var(--accent-brass)] px-4 text-[14px] font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brass)]"
            >
              {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Sign in
            </button>
          </form>

          <div className="mt-5 text-center text-[12px] text-[var(--text-muted)]">
            <Link href="/" className="hover:text-[var(--text-primary)]">Back to site</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPageClient(props: { turnstileEnabled: boolean; nonce?: string }) {
  return (
    <Suspense fallback={<main className="grid min-h-[100svh] place-items-center bg-[var(--surface-canvas)] text-sm text-[var(--text-muted)]">Loading sign in…</main>}>
      <LoginClient {...props} />
    </Suspense>
  );
}
