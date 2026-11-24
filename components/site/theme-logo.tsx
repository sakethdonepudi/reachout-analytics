"use client";

import { Logo } from "@/components/site/brand";
import { useTheme } from "@/components/site/theme";

export function ThemeLogo({ className, linked = true, href = "/" }: { className?: string; linked?: boolean; href?: string }) {
  const { theme } = useTheme();
  return <Logo className={className} linked={linked} href={href} variant={theme === "dark" ? "dark" : "light"} />;
}

export default ThemeLogo;
