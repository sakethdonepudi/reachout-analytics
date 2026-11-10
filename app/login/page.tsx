import { headers } from "next/headers";
import LoginPageClient from "./login-client";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <LoginPageClient googleEnabled={!!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET} nonce={nonce} />;
}
