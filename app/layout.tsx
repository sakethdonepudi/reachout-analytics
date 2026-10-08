import type { Metadata } from "next";
import "./globals.css";
import RouteTransition from "@/components/site/route-transition";
import ThemeProvider, { ThemeScript } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "ReachOut Analytics — Winning Elections with Data",
  description:
    "India's political analytics and campaign strategy experts. Voter insights, election predictions and digital boosting across India.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
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
          {children}
          <RouteTransition />
        </ThemeProvider>
      </body>
    </html>
  );
}
