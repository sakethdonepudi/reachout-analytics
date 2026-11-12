import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison for tokens and shared values. Passwords themselves
 * are verified with argon2id in lib/users.ts; this helper is used for the
 * setup token and security tests.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  return timingSafeEqual(ah, bh);
}

export function passwordsAreEqual(owner: string | undefined, client: string | undefined): boolean {
  return Boolean(owner && client && constantTimeEqual(owner, client));
}
