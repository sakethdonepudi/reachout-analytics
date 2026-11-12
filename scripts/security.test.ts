/* Security regression tests. Run: npx tsx scripts/security.test.ts */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { canAccess, roleHome, rolesForPath, safeNextPath } from "@/lib/access";
import { csrfCheck } from "@/lib/csrf";
import { verifyPkce, createPkce } from "@/lib/oauth-pkce";
import { signPayload, verifyPayload } from "@/lib/signed-cookie";
import { redact, redactText, maskEmail } from "@/lib/redact";
import { RECENT_MS, sessionIsRecent, type Session } from "@/lib/auth";
import { buildCsp, PROTECTED_HEADERS } from "@/lib/security";
import { secretProblems, turnstileConfigProblems } from "@/lib/security-config";
import { turnstileConfigured } from "@/lib/turnstile";
import { passwordsAreEqual } from "@/lib/passwords";
import { beginLoginAttempt, loginLockRemaining, loginRateLimitMessage, recordLoginFailure, recordLoginSuccess, resetLoginGuards } from "@/lib/login-guard";

let pass = 0, fail = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
function eq(name: string, got: unknown, want: unknown) {
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}
function setEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

console.log("\n1. Open redirect protection");
for (const evil of ["//evil.com", "/\\evil.com", "https://evil.com", "/%2F%2Fevil.com", "/\u0000evil", "javascript:alert(1)"]) {
  eq(`reject ${JSON.stringify(evil)}`, safeNextPath(evil, "owner"), null);
}
eq("accept deep case-study path", safeNextPath("/case-studies/tamil-nadu?year=2026", "client"), "/case-studies/tamil-nadu?year=2026");
eq("reject owner path for client", safeNextPath("/dashboard", "client"), null);
eq("reject api path", safeNextPath("/api/data/summary", "owner"), null);

console.log("\n2. Route-by-role matrix");
eq("case studies owner", canAccess("owner", "/case-studies"), true);
eq("case studies client", canAccess("client", "/case-studies"), true);
eq("campaigns client", canAccess("client", "/campaigns"), true);
eq("meta paths redirect outside access control", rolesForPath("/meta-ads/settings"), null);
eq("case-studies manager client", canAccess("client", "/dashboard/case-studies"), false);
eq("admin legacy redirects before access", rolesForPath("/admin"), null);
eq("data client", canAccess("client", "/api/data/summary"), false);
eq("template public", rolesForPath("/api/data/template"), null);
eq("home public", rolesForPath("/"), null);
eq("owner home", roleHome("owner"), "/dashboard");
eq("client home", roleHome("client"), "/case-studies");

console.log("\n3. Password login");
eq("equal passwords detected", passwordsAreEqual("same-pass", "same-pass"), true);
eq("different passwords", passwordsAreEqual("owner-pass", "client-pass"), false);

console.log("\n4. Login throttling and lockout");
resetLoginGuards();
const t0 = 1_000_000_000_000;
for (let i = 0; i < 5; i++) eq(`attempt ${i + 1} allowed`, beginLoginAttempt("ip-a", t0).ok, true);
const sixth = beginLoginAttempt("ip-a", t0);
eq("sixth attempt blocked", sixth.ok, false);
ok("retry-after is positive", sixth.retryAfter > 0);
eq("different IP unaffected", beginLoginAttempt("ip-b", t0).ok, true);

resetLoginGuards();
for (let i = 0; i < 10; i++) recordLoginFailure("ip-c", t0);
ok("locked after ten failures", loginLockRemaining("ip-c", t0) > 0);
eq("locked attempt blocked", beginLoginAttempt("ip-c", t0).ok, false);
eq("lock expires after 15 minutes", beginLoginAttempt("ip-c", t0 + 15 * 60 * 1000 + 1).ok, true);

resetLoginGuards();
for (let i = 0; i < 9; i++) recordLoginFailure("ip-d", t0);
recordLoginSuccess("ip-d");
eq("success clears failures", loginLockRemaining("ip-d", t0), 0);
eq("rate-limit message uses minutes", loginRateLimitMessage(120), "Too many attempts. Try again in 2 minutes.");

console.log("\n4b. Recent authentication");
const now = Date.now();
const fresh: Session = { sub: "owner", role: "owner", exp: now + 60_000, iat: now, lastSeen: now, authTime: now };
ok("fresh session is recent", sessionIsRecent(fresh));
ok("stale session needs re-auth", !sessionIsRecent({ ...fresh, authTime: now - RECENT_MS - 1 }));

console.log("\n5. CSRF");
const base = { origin: "https://app.example", siteOrigin: "https://app.example", headerToken: "a".repeat(32), cookieToken: "a".repeat(32) };
eq("valid POST", csrfCheck({ ...base, method: "POST" }), true);
eq("GET bypass", csrfCheck({ ...base, method: "GET", origin: "https://evil.example" }), true);
eq("wrong origin", csrfCheck({ ...base, method: "POST", origin: "https://evil.example" }), false);
eq("missing header", csrfCheck({ ...base, method: "POST", headerToken: null }), false);
eq("mismatch", csrfCheck({ ...base, method: "PATCH", cookieToken: "b".repeat(32) }), false);

console.log("\n6. PKCE and signed OAuth state");
const pkce = createPkce();
eq("PKCE verifier matches", verifyPkce(pkce.verifier, pkce.challenge), true);
eq("PKCE mismatch rejected", verifyPkce("wrong", pkce.challenge), false);
const stateToken = signPayload({ state: "state-a", nonce: "nonce-b", verifier: "verifier-c" }, "test-secret", 10_000);
eq("state payload round-trips", verifyPayload<{ state: string }>(stateToken, "test-secret")?.state, "state-a");
eq("wrong secret rejected", verifyPayload(stateToken, "other-secret"), null);
eq("tampered signature rejected", verifyPayload(`${stateToken.slice(0, -1)}${stateToken.endsWith("x") ? "y" : "x"}`, "test-secret"), null);
eq("expired state rejected", verifyPayload(signPayload({ state: "old" }, "test-secret", -1), "test-secret"), null);

console.log("\n7. Redaction");
const redacted = JSON.stringify(redact({
  token: "secret-token", nested: { authorization: "Bearer abc", password: "hunter2" },
  email: "person@example.com", cookie: "session=abc", safe: "visible",
}));
ok("token removed", !redacted.includes("secret-token"));
ok("authorization removed", !redacted.includes("Bearer abc"));
ok("password removed", !redacted.includes("hunter2"));
ok("email masked", redacted.includes(maskEmail("person@example.com")) && !redacted.includes("person@example.com"));
ok("safe value kept", redacted.includes("visible"));
const errorText = redactText("Meta failed for person@example.com token=abc123 Authorization: Bearer xyz");
ok("embedded email masked in error text", errorText.includes(maskEmail("person@example.com")) && !errorText.includes("person@example.com"));
ok("embedded token masked in error text", !errorText.includes("abc123") && !errorText.includes("Bearer xyz"));

console.log("\n9. Security headers and CSP");
const cspOff = buildCsp("abc123");
ok("default-src self", cspOff.includes("default-src 'self'"));
ok("nonce present", cspOff.includes("'nonce-abc123'"));
ok("frame-ancestors none", cspOff.includes("frame-ancestors 'none'"));
ok("object-src none", cspOff.includes("object-src 'none'"));
ok("script-src does not allow unsafe-inline", !/script-src[^;]*'unsafe-inline'/.test(cspOff));
ok("no Google in form-action", !cspOff.includes("accounts.google.com"));
eq("protected cache control", PROTECTED_HEADERS["Cache-Control"], "private, no-store, max-age=0");
eq("protected vary", PROTECTED_HEADERS.Vary, "Cookie");

ok("Turnstile is not configured without keys", turnstileConfigured() === false);
ok("auth pages can opt in to Cloudflare in CSP", buildCsp("abc123", { turnstile: true }).includes("challenges.cloudflare.com"));
ok("non-auth pages omit Cloudflare from CSP", !buildCsp("abc123").includes("challenges.cloudflare.com"));

console.log("\n10. No dev auth bypass in shipping code");
function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git" || name === ".context") continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...filesUnder(path));
    else if (/\.(ts|tsx|js|mjs)$/.test(name) && !path.endsWith("scripts/security.test.ts") && !path.endsWith("scripts/security-check.mjs")) out.push(path);
  }
  return out;
}
const sources = filesUnder(process.cwd());
const needle = "process.env." + "CASE_STUDY_" + "DEV_BYPASS";
const bypassHits = sources.filter((file) => readFileSync(file, "utf8").includes(needle));
eq("no CASE_STUDY_DEV_BYPASS", bypassHits, []);

console.log("\n11. Startup configuration");
const startupEnv = {
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
};
try {

  setEnv("ADMIN_SESSION_SECRET", "x".repeat(32));
  setEnv("MONGODB_URI", "mongodb://example.invalid/reachout");
  setEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32).toString("base64"));
  eq("minimal required env passes startup", secretProblems(), []);

  setEnv("TURNSTILE_SECRET_KEY", undefined);
  setEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", undefined);
  eq("Turnstile needs no keys when fully disabled", turnstileConfigProblems(), []);
  setEnv("TURNSTILE_SECRET_KEY", "test-secret");
  ok("a half-configured Turnstile requires the site key", turnstileConfigProblems().includes("NEXT_PUBLIC_TURNSTILE_SITE_KEY is required"));
} finally {
  for (const [key, value] of Object.entries(startupEnv)) setEnv(key, value);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
