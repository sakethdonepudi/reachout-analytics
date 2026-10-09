"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Discreet footer link: "Admin Login" (anon) or "Admin Dashboard" (signed in). */
export default function AdminLink({ className }: { className?: string }) {
  const [state, setState] = useState<"loading" | "auth" | "anon">("loading");
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/session")
      .then((r) => alive && setState(r.ok ? "auth" : "anon"))
      .catch(() => alive && setState("anon"));
    return () => { alive = false; };
  }, []);
  if (state === "loading") return null;
  return (
    <Link href={state === "auth" ? "/admin" : "/login"} className={cn("transition-colors hover:text-foreground", className)}>
      {state === "auth" ? "Admin Dashboard" : "Admin Login"}
    </Link>
  );
}
