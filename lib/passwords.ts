import { createHash, timingSafeEqual } from "node:crypto";
import type { Role } from "@/lib/access";

/**
 * Password matching for the owner/client login.
 *
 * Both candidate hashes are compared in constant time. The passwords are
 * hashed first so different lengths do not short-circuit the comparison.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  return timingSafeEqual(ah, bh);
}

export function passwordsAreEqual(owner: string | undefined, client: string | undefined): boolean {
  return Boolean(owner && client && constantTimeEqual(owner, client));
}

export function roleForPassword(password: string, owner: string | undefined, client: string | undefined): Role | null {
  if (!password || !owner || !client) return null;
  const ownerMatch = constantTimeEqual(password, owner);
  const clientMatch = constantTimeEqual(password, client);
  if (ownerMatch) return "owner";
  if (clientMatch) return "client";
  return null;
}

export function ownerPasswordMatches(password: string): boolean {
  const owner = process.env.ADMIN_PASSWORD;
  return Boolean(password && owner && constantTimeEqual(password, owner));
}
