export const PROTECTED_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
} as const;

export function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  const script = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "https://challenges.cloudflare.com",
    ...(dev ? ["'unsafe-eval'"] : []),
  ].join(" ");
  const frames = "https://challenges.cloudflare.com";
  return [
    "default-src 'self'",
    `script-src ${script}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self' data: https://challenges.cloudflare.com https://*.challenges.cloudflare.com",
    "media-src 'self'",
    `frame-src ${frames}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function securityHeaders(nonce: string): Record<string, string> {
  return {
    "Content-Security-Policy": buildCsp(nonce),
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Frame-Options": "DENY",
  };
}

export function applyHeaders(response: Response, headers: Record<string, string>) {
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}
