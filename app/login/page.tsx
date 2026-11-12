import { headers } from "next/headers";
import LoginPageClient from "./login-client";
import { turnstileConfigured } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <LoginPageClient turnstileEnabled={turnstileConfigured()} nonce={nonce} />;
}
