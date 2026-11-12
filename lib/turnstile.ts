import "server-only";

import { createHash } from "node:crypto";
import { getMongo } from "@/lib/mongodb";

/**
 * Cloudflare Turnstile verification.
 * Mandatory in production. Tokens are action-bound, hostname-bound and
 * single-use (recorded server-side for their short lifetime).
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

export function turnstileRequired(): boolean {
  return process.env.NODE_ENV === "production" || turnstileConfigured();
}

export type TurnstileResult = { ok: boolean; configured: boolean; error?: string };

async function usedToken(token: string): Promise<boolean> {
  const promise = getMongo();
  if (!promise) return false;
  const client = await promise;
  const col = client.db(process.env.MONGODB_DB || "reachout").collection<{ _id: string; expiresAt: Date }>("turnstile_tokens");
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
  const _id = createHash("sha256").update(token).digest("hex");
  try {
    await col.insertOne({ _id, expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
    return false;
  } catch {
    return true;
  }
}

export async function verifyTurnstile(
  token: string,
  ip: string,
  options: { action: string; hostname?: string | null },
): Promise<TurnstileResult> {
  if (!turnstileRequired()) return { ok: true, configured: false };
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    return { ok: false, configured: false, error: "Sign-in unavailable" };
  }
  if (!token) return { ok: false, configured: true, error: "Missing CAPTCHA token" };
  if (await usedToken(token)) return { ok: false, configured: true, error: "CAPTCHA token already used" };

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch(VERIFY_URL, { method: "POST", body, cache: "no-store" });
    const data = (await res.json()) as {
      success: boolean;
      hostname?: string;
      action?: string;
      "error-codes"?: string[];
    };
    if (!data.success) return { ok: false, configured: true, error: (data["error-codes"] ?? ["invalid-token"]).join(", ") };
    if (data.action && data.action !== options.action) return { ok: false, configured: true, error: "CAPTCHA action mismatch" };
    if (options.hostname && data.hostname && data.hostname !== options.hostname) return { ok: false, configured: true, error: "CAPTCHA hostname mismatch" };
    return { ok: true, configured: true };
  } catch {
    return { ok: false, configured: true, error: "CAPTCHA service unreachable" };
  }
}
