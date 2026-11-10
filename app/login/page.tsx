import { headers } from "next/headers";
import LoginPageClient from "./login-client";
import { turnstileEnabled } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <LoginPageClient turnstileEnabled={turnstileEnabled()} nonce={nonce} />;
}
