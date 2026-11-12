/** Client-safe password strength meter. Server checks live in password-policy.server.ts. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  const value = String(password ?? "");
  if (!value) return 0;
  let score = 0;
  if (value.length >= 12) score += 1;
  if (value.length >= 16) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}
