import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import PasswordClient from "./password-client";
import { PENDING_COOKIE } from "@/lib/pending-auth";
import { getSessionByToken, COOKIE, LEGACY_COOKIE } from "@/lib/auth";
import { turnstileConfigured } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  const params = await searchParams;
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value ?? jar.get(LEGACY_COOKIE)?.value;
  const session = await getSessionByToken(token);
  const pending = jar.get(PENDING_COOKIE)?.value;
  if (!session && !pending) redirect("/login");
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <PasswordClient first={params.first === "1" || !session} turnstileEnabled={turnstileConfigured()} nonce={nonce} />;
}
