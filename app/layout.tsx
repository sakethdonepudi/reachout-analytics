import type { Metadata } from "next";
import "./globals.css";
import CsrfFetch from "@/components/site/csrf-fetch";
import { ReauthProvider } from "@/components/auth/reauth-provider";
import IdleProvider from "@/components/auth/idle-provider";

export const metadata: Metadata = {
  title: "ReachOut Analytics — Winning Elections with Data",
  description:
    "India's political analytics and campaign strategy experts. Voter insights, election predictions and digital boosting across India.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <CsrfFetch />
        <ReauthProvider><IdleProvider>{children}</IdleProvider></ReauthProvider>
      </body>
    </html>
  );
}
