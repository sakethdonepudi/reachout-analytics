"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Logo } from "@/components/site/navbar";
import ThemeToggle from "@/components/site/theme-toggle";
import Turnstile from "@/components/site/turnstile";
import { useTheme } from "@/components/theme-provider";

/** Only allow internal return paths; the case-study selector is the default. */
function safeNext(value: string | null) {
  if (!value) return "/case-studies";
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return "/case-studies";
    if (url.pathname === "/login" || url.pathname.startsWith("/login/")) return "/case-studies";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/case-studies";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [resetNonce, setResetNonce] = useState(0);
  const onVerify = useCallback((t: string) => setToken(t), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, turnstileToken: token }) });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "Sign-in failed");
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(safeNext(next));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setResetNonce((n) => n + 1);
      setToken("");
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
          <p className="mt-14 text-[10px] font-bold uppercase tracking-[0.24em] text-saffron-2">Protected case studies</p>
          <p className="mt-4 max-w-xl font-display text-[clamp(42px,4.6vw,68px)] font-semibold leading-[.96] tracking-[-0.045em]">
            Election intelligence,
            <br />
            <span className="text-gradient-saffron font-serif font-normal italic">behind sign-in.</span>
          </p>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            The state selector and election dashboards are restricted to the ReachOut team. Sign in to choose a state and open its protected case study.
          </p>
          <ul className="mt-8 space-y-2.5 text-[13px] text-foreground/70">
            {["State selector and case-study dashboards", "Survey and election intelligence", "Protected exports and data"].map((item) => (
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
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-saffron-2">Admin access</p>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em]">Case study sign in</h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">Enter the administrator password to open the case studies.</p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Password</span>
                <span className="relative block">
                  <input
                    type={show ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-border bg-elevated/60 px-3.5 py-2.5 pr-10 text-base outline-none focus:border-saffron/60 focus:ring-2 focus:ring-saffron/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60"
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </span>
              </label>

              <div className="flex justify-center">
                <Turnstile onVerify={onVerify} theme={theme} resetNonce={resetNonce} />
              </div>
              {!token && <p className="text-center text-[12px] text-muted-foreground">Complete the CAPTCHA to enable sign in.</p>}

              {error && <p role="alert" className="rounded-xl border border-saffron/30 bg-saffron/10 px-3 py-2 text-[12.5px] text-saffron-2">{error}</p>}

              <button type="submit" disabled={loading || !token}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-saffron px-4 py-2.5 text-sm font-semibold text-[#241203] transition hover:brightness-105 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50">
                {loading && <Loader2 className="size-4 animate-spin" />} Sign in
              </button>
            </form>

            <div className="mt-4 text-center text-[12px] text-muted-foreground">
              <Link href="/" className="hover:text-foreground">Back to site</Link>
            </div>
          </div>
          <p className="mt-5 text-center text-[12px] text-muted-foreground">Single admin account — registration is disabled.</p>
        </div>
      </div>
    </main>
  );
}
