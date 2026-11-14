import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import LoginPageClient from "./login-client";
import { turnstileConfigured } from "@/lib/turnstile";
import { COOKIE, LEGACY_COOKIE, getSessionByToken } from "@/lib/auth";
import { roleHome } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const jar = await cookies();
  const session = await getSessionByToken(jar.get(COOKIE)?.value ?? jar.get(LEGACY_COOKIE)?.value);
  if (session) redirect(roleHome(session.role));
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <LoginPageClient turnstileEnabled={turnstileConfigured()} nonce={nonce} />;
}
