import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import RouteTransition from "@/components/site/route-transition";
import NavigationLoader from "@/components/site/navigation-loader";
import RouteHistory from "@/components/site/route-history";
import HashScroller from "@/components/site/hash-scroller";
import CsrfFetch from "@/components/site/csrf-fetch";
import { ReauthProvider } from "@/components/auth/reauth-provider";
import IdleProvider from "@/components/auth/idle-provider";

const inter = localFont({
  src: [
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  preload: false,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});
const interTight = localFont({
  src: [
    { path: "./fonts/inter-tight-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-tight-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/inter-tight-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/inter-tight-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-inter-tight",
  display: "swap",
  preload: false,
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
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${instrumentSerif.variable}`}>
      <body>
        <CsrfFetch />
        <ReauthProvider><IdleProvider>{children}</IdleProvider></ReauthProvider>
        <RouteTransition />
        <NavigationLoader />
        <RouteHistory />
        <HashScroller />
      </body>
    </html>
  );
}
