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
  return [
    "default-src 'self'",
    `script-src ${script}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https://*.fbcdn.net https://*.cdninstagram.com https://www.facebook.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self'",
    "media-src 'self' https://*.fbcdn.net",
    "frame-src https://challenges.cloudflare.com https://www.facebook.com",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self' https://accounts.google.com https://www.facebook.com",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function securityHeaders(nonce: string): Record<string, string> {
  return {
    "Content-Security-Policy": buildCsp(nonce),
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Frame-Options": "DENY",
  };
}

export function applyHeaders(response: Response, headers: Record<string, string>) {
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}
