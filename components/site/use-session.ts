"use client";

import { useEffect, useState } from "react";

export type SessionState = "loading" | "auth" | "anon";
export type SessionRole = "owner" | "client" | null;

/** Lightweight client session probe used by the public header. */
export function useSession() {
  const [state, setState] = useState<SessionState>("loading");
  const [role, setRole] = useState<SessionRole>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (r) => {
        if (!alive) return;
        if (!r.ok) { setState("anon"); return; }
        const data = await r.json();
        setState("auth");
        setRole(data.role === "client" ? "client" : "owner");
      })
      .catch(() => alive && setState("anon"));
    return () => { alive = false; };
  }, []);

  return { state, authed: state === "auth", anon: state === "anon", role };
}
