"use client";

import { Logo } from "@/components/site/brand";
export function ThemeLogo({ className, linked = true, href = "/" }: { className?: string; linked?: boolean; href?: string }) {
  return <Logo className={className} linked={linked} href={href} variant="auto" />;
}

export default ThemeLogo;
