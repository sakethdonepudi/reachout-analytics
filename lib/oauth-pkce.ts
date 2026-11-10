import { createHash, randomBytes } from "node:crypto";

export const randomUrlToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false;
  const actual = Buffer.from(pkceChallenge(verifier));
  const expected = Buffer.from(challenge);
  return actual.length === expected.length && actual.equals(expected);
}

export function createPkce() {
  const verifier = randomUrlToken(48);
  return { verifier, challenge: pkceChallenge(verifier) };
}

export function createOAuthState() {
  return { state: randomUrlToken(32), nonce: randomUrlToken(32) };
}
