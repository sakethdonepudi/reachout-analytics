/**
 * Server-side Cloudflare Turnstile verification.
 * The secret key never leaves the server. Tokens are single-use and expire.
 */
export async function verifyTurnstile(token: string, ip: string): Promise<{ configured: boolean; ok: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { configured: false, ok: false, error: "CAPTCHA not configured" };
  if (!token) return { configured: true, ok: false, error: "Missing CAPTCHA token" };
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    if (data.success) return { configured: true, ok: true };
    return { configured: true, ok: false, error: (data["error-codes"] ?? ["invalid-token"]).join(", ") };
  } catch {
    return { configured: true, ok: false, error: "CAPTCHA service unreachable" };
  }
}
