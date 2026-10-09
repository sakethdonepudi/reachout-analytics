"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Logo } from "@/components/site/navbar";
import ThemeToggle from "@/components/site/theme-toggle";
import Turnstile from "@/components/site/turnstile";
import { useTheme } from "@/components/theme-provider";

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
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setResetNonce((n) => n + 1); // always reset the challenge after a failure
      setToken("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-[100svh] items-center justify-center bg-background px-5 py-16 text-foreground">
      <div className="absolute right-5 top-5"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-[0_24px_60px_-30px_rgba(15,20,30,.4)]">
          <h1 className="font-display text-2xl font-semibold">Data portal sign in</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Enter the administrator password to continue.</p>

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
    </main>
  );
}
