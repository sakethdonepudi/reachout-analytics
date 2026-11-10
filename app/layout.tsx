import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import RouteTransition from "@/components/site/route-transition";
import ThemeProvider, { ThemeScript } from "@/components/theme-provider";
import CsrfFetch from "@/components/site/csrf-fetch";

export const metadata: Metadata = {
  title: "ReachOut Analytics — Winning Elections with Data",
  description:
    "India's political analytics and campaign strategy experts. Voter insights, election predictions and digital boosting across India.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript nonce={nonce} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap"
        />
      </head>
      <body>
        <ThemeProvider>
          <CsrfFetch />
          {children}
          <RouteTransition />
        </ThemeProvider>
      </body>
    </html>
  );
}
