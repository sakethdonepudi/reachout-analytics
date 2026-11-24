import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import RouteTransition from "@/components/site/route-transition";
import NavigationLoader from "@/components/site/navigation-loader";
import RouteHistory from "@/components/site/route-history";
import HashScroller from "@/components/site/hash-scroller";
import MotionTier from "@/components/site/motion-tier";
import CsrfFetch from "@/components/site/csrf-fetch";
import { ReauthProvider } from "@/components/auth/reauth-provider";
import IdleProvider from "@/components/auth/idle-provider";
import { ThemeProvider } from "@/components/site/theme";

const inter = localFont({
  src: [
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  preload: true,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});
const interTight = localFont({
  src: [
    { path: "./fonts/inter-tight-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-inter-tight",
  display: "swap",
  preload: true,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});
const instrumentSerif = localFont({
  src: [
    { path: "./fonts/instrument-serif-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
  preload: false,
  fallback: ["ui-serif", "Georgia", "serif"],
});

export const metadata: Metadata = {
  title: "ReachOut Analytics - Winning Elections with Data",
  description:
    "India's political analytics and campaign strategy experts. Voter insights, election predictions and digital boosting across India.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false, noimageindex: true } },
};

const THEME_SCRIPT = `(function(){try{var k="ro-theme";var s=localStorage.getItem(k);var t=s==="dark"||s==="light"?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}catch(e){}})();`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${instrumentSerif.variable}`} suppressHydrationWarning>
      <head><script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body>
        <ThemeProvider>
          <CsrfFetch />
          <ReauthProvider><IdleProvider>{children}</IdleProvider></ReauthProvider>
          <RouteTransition />
          <NavigationLoader />
          <RouteHistory />
          <HashScroller />
          <MotionTier />
        </ThemeProvider>
      </body>
    </html>
  );
}
