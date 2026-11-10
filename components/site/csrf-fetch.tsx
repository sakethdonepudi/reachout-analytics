"use client";

import { useEffect } from "react";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const COOKIE = "ro_csrf";

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Adds the double-submit CSRF header to every same-origin mutating fetch. */
export default function CsrfFetch() {
  useEffect(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      let sameOrigin = false;
      try { sameOrigin = new URL(url, window.location.origin).origin === window.location.origin; } catch { /* ignore */ }
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (!sameOrigin || !MUTATING.has(method)) return original(input, init);
      const token = readCookie(COOKIE);
      if (!token) return original(input, init);
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      headers.set("x-csrf-token", token);
      return original(input, { ...init, headers });
    };
    return () => { window.fetch = original; };
  }, []);
  return null;
}
