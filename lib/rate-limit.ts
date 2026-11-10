type Entry = { count: number; reset: number };
const buckets = new Map<string, Entry>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  current.count += 1;
  if (current.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((current.reset - now) / 1000)) };
  }
  return { ok: true, remaining: limit - current.count, retryAfter: 0 };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

export function rateLimitResponse(retryAfter: number) {
  return Response.json({ ok: false, error: "Too many requests" }, {
    status: 429,
    headers: { "Retry-After": String(retryAfter), "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
