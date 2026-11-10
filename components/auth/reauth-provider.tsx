"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";

type ReauthContextValue = { requestReauth: () => Promise<boolean> };

const ReauthContext = createContext<ReauthContextValue | null>(null);

export function ReauthProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const finish = useCallback((ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setOpen(false);
    setPassword("");
    setBusy(false);
    setError("");
  }, []);

  const requestReauth = useCallback(() => {
    if (resolveRef.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setPassword("");
      setError("");
      setOpen(true);
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/reauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(response.status === 401 ? "Incorrect password" : typeof data.error === "string" ? data.error : "Could not re-authenticate");
        return;
      }
      finish(true);
    } catch {
      setError("Could not re-authenticate");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("reauth") !== "1") return;
    url.searchParams.delete("reauth");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    void requestReauth();
  }, [requestReauth]);

  return (
    <ReauthContext.Provider value={{ requestReauth }}>
      {children}
      <Dialog
        open={open}
        onClose={() => finish(false)}
        title="Confirm owner password"
        description="Re-enter the owner password to continue."
        footer={(
          <>
            <button type="button" onClick={() => finish(false)} className="min-h-10 rounded-[var(--radius-control)] border border-[var(--border-hairline)] px-4 text-[12.5px] font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brass)]">
              Cancel
            </button>
            <button type="submit" form="reauth-form" disabled={busy || !password} className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent-brass)] px-4 text-[12.5px] font-semibold text-white disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brass)]">
              {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />} Continue
            </button>
          </>
        )}
      >
        <form id="reauth-form" onSubmit={submit} className="space-y-2">
          <label htmlFor="reauth-password" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Owner password</label>
          <input
            id="reauth-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 text-[13px] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brass)]"
          />
          {error && <p role="alert" className="text-[12px] text-[var(--danger)]">{error}</p>}
        </form>
      </Dialog>
    </ReauthContext.Provider>
  );
}

export function useReauth() {
  const value = useContext(ReauthContext);
  if (!value) throw new Error("useReauth must be used inside ReauthProvider");
  return value;
}
