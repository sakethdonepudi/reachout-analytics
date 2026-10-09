"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Logo } from "@/components/site/navbar";
import ThemeToggle from "@/components/site/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [reset, setReset] = useState({ token: "", newPassword: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "Sign-in failed");
      router.push("/data");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function doReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, ...reset }) });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "Reset failed");
      setError(""); setResetOpen(false); setReset({ token: "", newPassword: "" });
      setError("Password updated — you can sign in now.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
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
          <p className="mt-1.5 text-[13px] text-muted-foreground">Protected access to poll datasets and exports.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Email</span>
              <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-elevated/60 px-3.5 py-2.5 text-sm outline-none focus:border-saffron/60 focus:ring-2 focus:ring-saffron/20" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Password</span>
              <span className="relative block">
                <input type={show ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-elevated/60 px-3.5 py-2.5 pr-10 text-sm outline-none focus:border-saffron/60 focus:ring-2 focus:ring-saffron/20" />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>

            {error && <p role="alert" className="rounded-xl border border-saffron/30 bg-saffron/10 px-3 py-2 text-[12.5px] text-saffron-2">{error}</p>}

            <button type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-saffron px-4 py-2.5 text-sm font-semibold text-[#241203] transition hover:brightness-105 disabled:opacity-60">
              {loading && <Loader2 className="size-4 animate-spin" />} Sign in
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-[12px] text-muted-foreground">
            <button type="button" onClick={() => setResetOpen((v) => !v)} className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">Forgot password?</button>
            <Link href="/" className="hover:text-foreground">Back to site</Link>
          </div>

          {resetOpen && (
            <form onSubmit={doReset} className="mt-4 space-y-3 border-t border-dashed border-border pt-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Reset token</span>
                <input value={reset.token} onChange={(e) => setReset((r) => ({ ...r, token: e.target.value }))} className="w-full rounded-xl border border-border bg-elevated/60 px-3.5 py-2.5 text-sm outline-none focus:border-saffron/60" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">New password</span>
                <input type="password" minLength={8} value={reset.newPassword} onChange={(e) => setReset((r) => ({ ...r, newPassword: e.target.value }))} className="w-full rounded-xl border border-border bg-elevated/60 px-3.5 py-2.5 text-sm outline-none focus:border-saffron/60" />
              </label>
              <button type="submit" disabled={loading} className="w-full rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-elevated">Reset password</button>
            </form>
          )}
        </div>
        <p className="mt-5 text-center text-[12px] text-muted-foreground">Registration is disabled — accounts are provisioned by an administrator.</p>
      </div>
    </main>
  );
}
