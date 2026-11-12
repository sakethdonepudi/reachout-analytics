import { headers } from "next/headers";
import { notFound } from "next/navigation";
import SetupClient from "./setup-client";
import { countOwners } from "@/lib/users";
import { turnstileConfigured } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const enabled = Boolean(process.env.SETUP_TOKEN) && (await countOwners()) === 0;
  if (!enabled) notFound();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <SetupClient turnstileEnabled={turnstileConfigured()} nonce={nonce} />;
}
