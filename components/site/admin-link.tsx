"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Auth-aware admin link: "Admin Login" (signed out) or "Dashboard" (signed in),
 * routing to /login or /admin respectively.
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
  const content = <>{icon && <Lock className="size-3.5" aria-hidden />}{authed ? "Dashboard" : "Admin Login"}</>;

  if (!authed) {
    return <a href="/login" aria-label="Admin login" className={className}>{content}</a>;
  }
  return (
    <Link href="/dashboard/case-studies" aria-label="Admin dashboard" className={className}>
      {content}
    </Link>
  );
}
