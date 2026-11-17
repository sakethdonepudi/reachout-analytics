"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Auth-aware access link: "Login" (signed out) or "Dashboard" (signed in).
 */
export default function AdminLink({ className: classNameProp, icon = false }: { className?: string; icon?: boolean }) {
  const [state, setState] = useState<"loading" | "auth" | "anon">("loading");
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/session")
      .then((r) => alive && setState(r.ok ? "auth" : "anon"))
      .catch(() => alive && setState("anon"));
    return () => { alive = false; };
  }, []);
  const authed = state === "auth";
  const className = cn("inline-flex items-center gap-1.5 transition-colors", classNameProp);
  const content = <>{icon && <Lock className="size-3.5" aria-hidden />}{authed ? "Dashboard" : "Login"}</>;

  if (!authed) {
    return <a href="/login" aria-label="Login" className={className}>{content}</a>;
  }
  return (
    <Link href="/dashboard" aria-label="Dashboard" className={className}>
      {content}
    </Link>
  );
}
