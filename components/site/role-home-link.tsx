"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

/** Link to the signed-in role's home, falling back to the public home. */
export default function RoleHomeLink({ className, children }: { className?: string; children: ReactNode }) {
  const [href, setHref] = useState("/");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (active && data?.role === "owner") setHref("/dashboard"); })
      .catch(() => { /* keep the public home */ });
    return () => { active = false; };
  }, []);

  return <Link href={href} className={className}>{children}</Link>;
}
