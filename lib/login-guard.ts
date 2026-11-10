/**
 * In-process login throttling.
 *
 * - 5 attempts per 15 minutes per IP.
 * - A 15-minute lockout after 10 recorded failures.
 *
 * The maps are per process. They are a defence-in-depth layer in front of the
 * password comparison, not a replacement for an edge/WAF rate limit.
 */

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

type Attempt = { count: number; reset: number };
type Failures = { count: number; lockedUntil: number };

const attempts = new Map<string, Attempt>();
const failures = new Map<string, Failures>();

export function loginLockRemaining(ip: string, now = Date.now()): number {
  const record = failures.get(ip);
  if (!record || record.lockedUntil <= now) return 0;
  return Math.max(1, Math.ceil((record.lockedUntil - now) / 1000));
}

/** Count one login request. Returns retryAfter seconds when blocked. */
export function beginLoginAttempt(ip: string, now = Date.now()): { ok: boolean; retryAfter: number } {
  const locked = loginLockRemaining(ip, now);
  if (locked) return { ok: false, retryAfter: locked };

  const current = attempts.get(ip);
  if (!current || current.reset <= now) {
    attempts.set(ip, { count: 1, reset: now + LOGIN_WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }
  if (current.count >= LOGIN_MAX_ATTEMPTS) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((current.reset - now) / 1000)) };
  }
  current.count += 1;
  return { ok: true, retryAfter: 0 };
}

/** Record a failed password check. The 10th failure starts the lockout. */
export function recordLoginFailure(ip: string, now = Date.now()): { locked: boolean; retryAfter: number } {
  const current = failures.get(ip) ?? { count: 0, lockedUntil: 0 };
  if (current.lockedUntil > now) {
    return { locked: true, retryAfter: Math.max(1, Math.ceil((current.lockedUntil - now) / 1000)) };
  }
  current.count += 1;
  if (current.count >= LOGIN_MAX_FAILURES) current.lockedUntil = now + LOGIN_LOCK_MS;
  failures.set(ip, current);
  return {
    locked: current.lockedUntil > now,
    retryAfter: current.lockedUntil > now ? Math.max(1, Math.ceil((current.lockedUntil - now) / 1000)) : 0,
  };
}

export function recordLoginSuccess(ip: string) {
  attempts.delete(ip);
  failures.delete(ip);
}

export function resetLoginGuards() {
  attempts.clear();
  failures.clear();
}
