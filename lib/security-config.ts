const REQUIRED = [
  "ADMIN_SESSION_SECRET",
  "MONGODB_URI",
  "TOKEN_ENCRYPTION_KEY",
  "CRON_SECRET",
] as const;

/** Meta is optional: without it the site still starts and Meta Ads is disabled. */
export function metaConfigWarning(): string | null {
  const missing: string[] = [];
  if (!process.env.META_APP_ID) missing.push("META_APP_ID");
  if (!process.env.META_APP_SECRET) missing.push("META_APP_SECRET");
  if (!missing.length) return null;
  return `Meta Ads is disabled: ${missing.join(" and ")} not configured.`;
}

export function turnstileConfigProblems(): string[] {
  const required = process.env.NODE_ENV === "production" || Boolean(process.env.TURNSTILE_SECRET_KEY || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  if (!required) return [];
  const problems: string[] = [];
  for (const key of ["TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY"] as const) {
    if (!process.env[key]) problems.push(`${key} is required`);
  }
  return problems;
}

export function secretProblems(): string[] {
  const problems: string[] = [];
  for (const key of REQUIRED) {
    const value = process.env[key];
    if (!value || value.trim().length === 0 || value === "[SENSITIVE]") problems.push(`${key} is missing`);
  }
  const session = process.env.ADMIN_SESSION_SECRET ?? "";
  if (session && session.length < 32) problems.push("ADMIN_SESSION_SECRET must be at least 32 characters");
  const tokenKey = process.env.TOKEN_ENCRYPTION_KEY ?? "";
  if (tokenKey) {
    try {
      if (Buffer.from(tokenKey, "base64").length !== 32) problems.push("TOKEN_ENCRYPTION_KEY must be 32 bytes encoded as base64");
    } catch {
      problems.push("TOKEN_ENCRYPTION_KEY is not valid base64");
    }
  }
  problems.push(...turnstileConfigProblems());
  return problems;
}

export function assertProductionSecrets() {
  if (process.env.NODE_ENV !== "production") return;
  const problems = secretProblems();
  if (problems.length) {
    throw new Error(`Security configuration incomplete: ${problems.join("; ")}`);
  }
}
