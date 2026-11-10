const REQUIRED = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "OWNER_EMAILS",
  "TOKEN_ENCRYPTION_KEY",
  "ADMIN_SESSION_SECRET",
  "CRON_SECRET",
  "TURNSTILE_SECRET_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
] as const;

/** Meta is optional: without it the site still starts and Meta Ads is disabled. */
export function metaConfigWarning(): string | null {
  const missing: string[] = [];
  if (!process.env.META_APP_ID) missing.push("META_APP_ID");
  if (!process.env.META_APP_SECRET) missing.push("META_APP_SECRET");
  if (!missing.length) return null;
  return `Meta Ads is disabled: ${missing.join(" and ")} not configured.`;
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
  const owners = String(process.env.OWNER_EMAILS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (process.env.OWNER_EMAILS && owners.length === 0) problems.push("OWNER_EMAILS must contain at least one email");
  if (process.env.NODE_ENV === "production" && !process.env.MONGODB_URI) problems.push("MONGODB_URI is missing");
  return problems;
}

export function assertProductionSecrets() {
  if (process.env.NODE_ENV !== "production") return;
  const problems = secretProblems();
  if (problems.length) {
    throw new Error(`Security configuration incomplete: ${problems.join("; ")}`);
  }
}
