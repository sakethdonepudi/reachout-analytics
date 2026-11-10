"use client";

import { Suspense, useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/site/navbar";
import ThemeToggle from "@/components/site/theme-toggle";
import Turnstile from "@/components/site/turnstile";
import { useTheme } from "@/components/theme-provider";

function LoginClient({ turnstileEnabled, nonce }: { turnstileEnabled: boolean; nonce?: string }) {
  const { theme } = useTheme();
  const search = useSearchParams();
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
  const onVerify = useCallback((value: string) => setToken(value), []);
  const next = search.get("next") ?? "";
  const queryError = search.get("error");

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
          : res.status === 429
            ? "Too many attempts. Try again later."
            : typeof data.error === "string"
              ? data.error
              : "Sign-in failed. Please try again.",
      );
      setPassword("");
      if (turnstileEnabled) setResetNonce((value) => value + 1);
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-40 -top-24 size-[520px] rounded-full bg-[radial-gradient(circle,rgba(245,138,36,.12),transparent_66%)] blur-2xl" />
        <div className="absolute -right-32 bottom-0 size-[460px] rounded-full bg-[radial-gradient(circle,rgba(47,191,74,.09),transparent_68%)] blur-2xl" />
      </div>
      <div className="absolute right-5 top-5 z-10"><ThemeToggle /></div>

      <div className="relative mx-auto grid min-h-[100svh] w-full max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_.95fr] lg:px-10">
        <section className="hidden lg:block">
          <Logo />
          <p className="mt-14 text-[10px] font-bold uppercase tracking-[0.24em] text-saffron-2">Protected workspace</p>
          <p className="mt-4 max-w-xl font-display text-[clamp(42px,4.6vw,68px)] font-semibold leading-[.96] tracking-[-0.045em]">
            Election intelligence,
            <br />
            <span className="text-gradient-saffron font-serif font-normal italic">behind sign-in.</span>
          </p>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            The state selector, campaign workspace and election dashboards are restricted to the ReachOut team. Enter the workspace password to open your workspace.
          </p>
          <ul className="mt-8 space-y-2.5 text-[13px] text-foreground/70">
            {["Case-study dashboards", "Campaign and Meta workspace", "Protected exports and data"].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="size-1.5 rounded-full bg-saffron" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <div className="w-full max-w-sm justify-self-center lg:justify-self-end">
          <div className="mb-8 flex justify-center lg:hidden"><Logo /></div>
          <div className="rounded-3xl border border-border bg-card p-6 shadow-[0_24px_60px_-34px_rgba(15,20,30,.45)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-saffron-2">Secure access</p>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em]">Sign in to ReachOut</h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">Enter the owner or client password to continue.</p>

            {(error || queryError) && (
              <p role="alert" className="mt-5 rounded-xl border border-saffron/30 bg-saffron/10 px-3 py-2 text-[12.5px] text-saffron-2">
                {error || "Sign-in could not be completed. Please try again."}
              </p>
            )}

            <form onSubmit={signIn} className="mt-5 space-y-3">
              <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-saffron focus:ring-2 focus:ring-saffron/25"
              />

              {turnstileEnabled && (
                <div className="flex justify-center">
                  <Turnstile onVerify={onVerify} theme={theme} resetNonce={resetNonce} nonce={nonce} />
                </div>
              )}
              {turnstileEnabled && !token && (
                <p className="text-center text-[12px] text-muted-foreground">Complete the CAPTCHA to enable sign in.</p>
              )}

              <button
                type="submit"
                disabled={loading || (turnstileEnabled && !token)}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Sign in
              </button>
            </form>

            <div className="mt-4 text-center text-[12px] text-muted-foreground">
              <Link href="/" className="hover:text-foreground">Back to site</Link>
            </div>
          </div>
          <p className="mt-5 text-center text-[12px] text-muted-foreground">Access is limited to the ReachOut owner and approved clients.</p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPageClient(props: { turnstileEnabled: boolean; nonce?: string }) {
  return (
    <Suspense fallback={<main className="grid min-h-[100svh] place-items-center bg-background text-sm text-muted-foreground">Loading sign in…</main>}>
      <LoginClient {...props} />
    </Suspense>
  );
}
