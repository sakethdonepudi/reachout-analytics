export const PROTECTED_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
} as const;

export function buildCsp(nonce: string, options: { turnstile?: boolean } = {}): string {
  const dev = process.env.NODE_ENV !== "production";
  const turnstile = Boolean(options.turnstile);
  const script = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(turnstile ? ["https://challenges.cloudflare.com"] : []),
    ...(dev ? ["'unsafe-eval'"] : []),
  ].join(" ");
  const frames = ["https://www.facebook.com", ...(turnstile ? ["https://challenges.cloudflare.com"] : [])].join(" ");
  return [
    "default-src 'self'",
    `script-src ${script}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https://*.fbcdn.net https://*.cdninstagram.com https://www.facebook.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    `connect-src 'self'${turnstile ? " https://challenges.cloudflare.com" : ""}`,
    "media-src 'self' https://*.fbcdn.net",
    `frame-src ${frames}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self' https://www.facebook.com",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function securityHeaders(nonce: string, options: { turnstile?: boolean } = {}): Record<string, string> {
  return {
    "Content-Security-Policy": buildCsp(nonce, options),
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
