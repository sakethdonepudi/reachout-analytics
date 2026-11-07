"use client";

import { useEffect, useState } from "react";

export type SessionState = "loading" | "auth" | "anon";

/** Lightweight client session probe used by the public header. */
export function useSession() {
  const [state, setState] = useState<SessionState>("loading");

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/session")
      .then((r) => alive && setState(r.ok ? "auth" : "anon"))
      .catch(() => alive && setState("anon"));
    return () => { alive = false; };
  }, []);

  return { state, authed: state === "auth", anon: state === "anon" };
}
