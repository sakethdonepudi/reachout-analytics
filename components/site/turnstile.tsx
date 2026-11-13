"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_ID = "cf-turnstile-script";
const LOAD_TIMEOUT_MS = 8000;

/**
 * Cloudflare Turnstile widget. Renders below the password field; the token is
 * verified server-side. The script is injected once and the widget renders
 * explicitly, so client-side visits to /login work without a refresh.
 */
export default function Turnstile({
  onVerify,
  theme = "light",
  resetNonce = 0,
  nonce,
  action = "login",
}: {
  onVerify: (token: string) => void;
  theme?: "light" | "dark";
  resetNonce?: number;
  nonce?: string;
  action?: "login" | "totp" | "setup" | "password";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [status, setStatus] = useState<"unconfigured" | "loading" | "ready" | "error">(SITE_KEY ? "loading" : "unconfigured");
  const [attempt, setAttempt] = useState(0);
  const verify = useCallback((token: string) => onVerify(token), [onVerify]);

  useEffect(() => {
    if (!SITE_KEY) { verify(""); return; }
    let cancelled = false;
    let timer = 0;

    const render = () => {
      if (cancelled || !ref.current || !window.turnstile) return;
      try {
        if (widgetId.current) {
          window.turnstile.remove(widgetId.current);
          widgetId.current = null;
        }
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          theme,
          action,
          callback: (token: string) => {
            if (cancelled) return;
            window.clearTimeout(timer);
            setStatus("ready");
            verify(token);
          },
          "expired-callback": () => verify(""),
          "error-callback": () => {
            if (cancelled) return;
            setStatus("error");
            verify("");
          },
        });
        setStatus((current) => (current === "error" ? current : "loading"));
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          if (cancelled) return;
          const appeared = Boolean(ref.current && ref.current.childElementCount > 0);
          if (!appeared) {
            setStatus("error");
            verify("");
          }
        }, LOAD_TIMEOUT_MS);
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (window.turnstile) {
      // Returning to /login: the API is already loaded, just render a fresh widget.
      render();
    } else if (script && attempt === 0) {
      script.addEventListener("load", render);
    } else {
      // First load, or a reload check after the previous script failed.
      script?.remove();
      const element = document.createElement("script");
      element.id = SCRIPT_ID;
      element.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      if (nonce) element.nonce = nonce;
      element.async = true;
      element.defer = true;
      element.onload = render;
      element.onerror = () => { if (!cancelled) setStatus("error"); };
      document.head.appendChild(element);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (script) script.removeEventListener("load", render);
      try {
        if (window.turnstile && widgetId.current) window.turnstile.remove(widgetId.current);
      } catch { /* ignore */ }
      widgetId.current = null;
    };
  }, [attempt, theme, verify, action, nonce]);

  useEffect(() => {
    if (!resetNonce) return;
    try {
      if (window.turnstile && widgetId.current) {
        window.turnstile.reset(widgetId.current);
        verify("");
      }
    } catch { /* ignore */ }
  }, [resetNonce, verify]);

  if (status === "unconfigured") {
    return (
      <p className="rounded-xl border border-teal/30 bg-teal/10 px-3 py-2 text-[12px] text-teal-deep">
        CAPTCHA is not configured on this deployment. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY.
      </p>
    );
  }

  return (
    <div>
      <div ref={ref} data-testid="turnstile-widget" />
      {status === "error" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-muted)]">
          <span>Security check didn&apos;t load.</span>
          <button
            type="button"
            onClick={() => { setStatus("loading"); setAttempt((value) => value + 1); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold text-[var(--text-primary)] hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
          >
            <RefreshCw className="size-3.5" /> Reload check
          </button>
        </div>
      )}
    </div>
  );
}
