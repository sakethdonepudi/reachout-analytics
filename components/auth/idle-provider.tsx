"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { announceOpening } from "@/lib/use-navigate";

const IDLE_MS = 10 * 60 * 1000;
const WARN_MS = 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;
const THROTTLE_MS = 5 * 1000;

type IdleState = { remainingMs: number; signedIn: boolean };
const IdleContext = createContext<IdleState>({ remainingMs: IDLE_MS, signedIn: false });

export function useIdle() { return useContext(IdleContext); }

export default function IdleProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [warn, setWarn] = useState(false);
  const [remaining, setRemaining] = useState(60);
  const [remainingMs, setRemainingMs] = useState(IDLE_MS);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const lastActivity = useRef(Date.now());
  const lastHeartbeat = useRef(0);
  const lastSignal = useRef(0);
  const signedIn = useRef(false);
  const loggingOut = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);

  const leave = useCallback((href: string, callLogout: boolean) => {
    const started = performance.now();
    announceOpening("Signing out", true);
    const go = () => {
      const remaining = 320 - (performance.now() - started);
      window.setTimeout(() => window.location.assign(href), Math.max(0, remaining));
    };
    if (callLogout) void fetch("/api/auth/logout", { method: "POST" }).catch(() => {}).finally(go);
    else go();
  }, []);

  const signOut = useCallback(() => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    channel.current?.postMessage({ type: "logout" });
    leave("/login?reason=idle", true);
  }, [leave]);

  const touch = useCallback((broadcast = true) => {
    const now = Date.now();
    lastActivity.current = now;
    setWarn(false);
    if (broadcast && channel.current && now - lastSignal.current > THROTTLE_MS) {
      lastSignal.current = now;
      channel.current.postMessage({ type: "activity" });
    }
    if (signedIn.current && now - lastHeartbeat.current > HEARTBEAT_MS) {
      lastHeartbeat.current = now;
      void fetch("/api/auth/heartbeat", { method: "POST" }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => { if (response.ok) { signedIn.current = true; setIsSignedIn(true); } })
      .catch(() => {});
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel.current = new BroadcastChannel("ro-idle");
      channel.current.onmessage = (event: MessageEvent) => {
        const type = (event.data as { type?: string } | null)?.type;
        if (type === "activity") touch(false);
        if (type === "logout") { loggingOut.current = true; leave("/login?reason=idle", false); }
      };
    }
    const onActivity = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastSignal.current < THROTTLE_MS) return;
      touch();
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/auth/session", { cache: "no-store" }).then((response) => {
        if (!response.ok) { loggingOut.current = true; leave("/login?reason=idle", false); return; }
        if (Date.now() - lastActivity.current > IDLE_MS) signOut();
      }).catch(() => {});
    };
    for (const event of ["mousemove", "mousedown", "keydown", "scroll", "wheel", "touchstart"]) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      if (cancelled || loggingOut.current || !signedIn.current) return;
      if (document.visibilityState !== "visible") return;
      const idle = Date.now() - lastActivity.current;
      const left = Math.max(0, IDLE_MS - idle);
      setRemainingMs(left);
      if (idle >= IDLE_MS) { signOut(); return; }
      if (idle >= IDLE_MS - WARN_MS) {
        setWarn(true);
        setRemaining(Math.max(0, Math.ceil((IDLE_MS - idle) / 1000)));
      } else {
        setWarn(false);
      }
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      for (const event of ["mousemove", "mousedown", "keydown", "scroll", "wheel", "touchstart"]) window.removeEventListener(event, onActivity);
      document.removeEventListener("visibilitychange", onVisible);
      channel.current?.close();
    };
  }, [signOut, touch]);

  return (
    <IdleContext.Provider value={{ remainingMs: isSignedIn ? remainingMs : IDLE_MS, signedIn: isSignedIn }}>
      {children}
      <Dialog
      open={warn}
      onClose={() => touch()}
      title="You'll be signed out in 60s"
      description="No activity was detected. Continue working to stay signed in."
    >
      <div className="space-y-4">
        <p aria-live="polite" className="text-center font-display text-4xl font-semibold tabular-nums">{remaining}s</p>
        <button type="button" onClick={() => touch()} className="min-h-11 w-full rounded-[var(--radius-control)] bg-[var(--accent-brass)] text-[13px] font-semibold text-[var(--text-on-brass)]">Stay signed in</button>
        <button type="button" onClick={() => signOut()} className="min-h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-hairline)] text-[12.5px] font-semibold text-[var(--text-muted)]">Sign out now</button>
      </div>
      </Dialog>
    </IdleContext.Provider>
  );
}
