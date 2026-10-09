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

/**
 * Cloudflare Turnstile widget. Renders below the password field; the token is
 * verified server-side. When the site key is absent it shows an explicit notice
 * (never a silent bypass). Loading failures offer a retry.
 */
export default function Turnstile({
  onVerify,
  theme = "light",
  resetNonce = 0,
}: {
  onVerify: (token: string) => void;
  theme?: "light" | "dark";
  resetNonce?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [status, setStatus] = useState<"unconfigured" | "loading" | "ready" | "error">(SITE_KEY ? "loading" : "unconfigured");
  const [attempt, setAttempt] = useState(0);
  const verify = useCallback((t: string) => onVerify(t), [onVerify]);

  useEffect(() => {
    if (!SITE_KEY) { verify(""); return; }
    let cancelled = false;
    const render = () => {
      if (cancelled || !ref.current || !window.turnstile) return;
      try {
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          theme,
          callback: (t: string) => { setStatus("ready"); verify(t); },
          "expired-callback": () => verify(""),
          "error-callback": () => { setStatus("error"); verify(""); },
        });
        setStatus("ready");
      } catch { setStatus("error"); }
    };
    const scriptId = "cf-turnstile-script";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      if (window.turnstile) render();
      else existing.addEventListener("load", render);
    } else {
      const s = document.createElement("script");
      s.id = scriptId;
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true; s.defer = true;
      s.onload = render;
      s.onerror = () => setStatus("error");
      document.head.appendChild(s);
    }
    return () => {
      cancelled = true;
      try { if (window.turnstile && widgetId.current) window.turnstile.remove(widgetId.current); } catch { /* ignore */ }
      widgetId.current = null;
    };
  }, [attempt, theme, verify]);

  useEffect(() => {
    if (!resetNonce) return;
    try { if (window.turnstile && widgetId.current) { window.turnstile.reset(widgetId.current); verify(""); } } catch { /* ignore */ }
  }, [resetNonce, verify]);

  if (status === "unconfigured") {
    return (
      <p className="rounded-xl border border-saffron/30 bg-saffron/10 px-3 py-2 text-[12px] text-saffron-2">
        CAPTCHA is not configured on this deployment — set NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY.
      </p>
    );
  }
  return (
    <div>
      <div ref={ref} />
      {status === "error" && (
        <button type="button" onClick={() => { setStatus("loading"); setAttempt((a) => a + 1); }}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
          <RefreshCw className="size-3.5" /> Retry CAPTCHA
        </button>
      )}
    </div>
  );
}
