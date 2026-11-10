"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/site/navbar";
import ThemeToggle from "@/components/site/theme-toggle";
import Turnstile from "@/components/site/turnstile";
import { useTheme } from "@/components/theme-provider";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.27c0-.8-.07-1.57-.2-2.32H12v4.4h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.86c2.26-2.08 3.58-5.15 3.58-8.7Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.86-3c-1.07.72-2.44 1.15-4.09 1.15-3.14 0-5.8-2.12-6.75-4.97H1.26v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.25 14.28A7.2 7.2 0 0 1 4.87 12c0-.79.14-1.56.38-2.28V6.63H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.37l3.99-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.63l3.99 3.09C6.2 6.87 8.86 4.75 12 4.75Z" />
    </svg>
  );
}

function LoginClient({ googleEnabled, nonce }: { googleEnabled: boolean; nonce?: string }) {
  const { theme } = useTheme();
  const search = useSearchParams();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
  const onVerify = useCallback((value: string) => setToken(value), []);
  const next = search.get("next") ?? "";
  const queryError = search.get("error");

  function signIn() {
    if (!googleEnabled) return;
    if (!token) { setError("Complete the CAPTCHA to continue."); return; }
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ turnstile: token });
    if (next) params.set("next", next);
    window.location.assign(`/api/auth/google/start?${params.toString()}`);
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
            The state selector, campaign workspace and election dashboards are restricted to the ReachOut team. Continue with Google to open your workspace.
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
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">Use your approved Google account to continue.</p>

            {!googleEnabled && (
              <p role="alert" className="mt-5 rounded-xl border border-saffron/30 bg-saffron/10 px-3 py-2 text-[12.5px] text-saffron-2">
                Google sign-in is not configured on this deployment.
              </p>
            )}
            {(error || queryError) && (
              <p role="alert" className="mt-5 rounded-xl border border-saffron/30 bg-saffron/10 px-3 py-2 text-[12.5px] text-saffron-2">
                {error || "Sign-in could not be completed. Please try again."}
              </p>
            )}

            <div className="mt-6 flex justify-center">
              <Turnstile onVerify={onVerify} theme={theme} resetNonce={resetNonce} nonce={nonce} />
            </div>
            {!token && <p className="mt-2 text-center text-[12px] text-muted-foreground">Complete the CAPTCHA to enable sign in.</p>}

            <button
              type="button"
              onClick={signIn}
              disabled={loading || !token || !googleEnabled}
              className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
              Continue with Google
            </button>

            <div className="mt-4 text-center text-[12px] text-muted-foreground">
              <Link href="/" className="hover:text-foreground">Back to site</Link>
            </div>
          </div>
          <p className="mt-5 text-center text-[12px] text-muted-foreground">Access is limited to approved accounts.</p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPageClient(props: { googleEnabled: boolean; nonce?: string }) {
  return (
    <Suspense fallback={<main className="grid min-h-[100svh] place-items-center bg-background text-sm text-muted-foreground">Loading sign in…</main>}>
      <LoginClient {...props} />
    </Suspense>
  );
}
