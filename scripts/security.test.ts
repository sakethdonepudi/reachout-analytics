/* Security regression tests. Run: npx tsx scripts/security.test.ts */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { canAccess, rolesForPath, safeNextPath } from "@/lib/access";
import { csrfCheck } from "@/lib/csrf";
import { verifyPkce, createPkce } from "@/lib/oauth-pkce";
import { signPayload, verifyPayload } from "@/lib/signed-cookie";
import { redact, maskEmail } from "@/lib/redact";
import { publicClientSummary } from "@/lib/meta/public";
import { metaConfigured } from "@/lib/meta/oauth";
import { buildCsp, PROTECTED_HEADERS } from "@/lib/security";
import { metaConfigWarning, secretProblems, turnstileConfigProblems } from "@/lib/security-config";
import { turnstileEnabled } from "@/lib/turnstile";
import { passwordsAreEqual, roleForPassword } from "@/lib/passwords";
import { beginLoginAttempt, loginLockRemaining, recordLoginFailure, recordLoginSuccess, resetLoginGuards } from "@/lib/login-guard";

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
eq("reject owner path for client", safeNextPath("/admin", "client"), null);
eq("reject api path", safeNextPath("/api/data/summary", "owner"), null);

console.log("\n2. Route-by-role matrix");
eq("case studies owner", canAccess("owner", "/case-studies"), true);
eq("case studies client", canAccess("client", "/case-studies"), true);
eq("campaigns client", canAccess("client", "/campaigns"), true);
eq("meta owner owner", canAccess("owner", "/meta-ads/settings"), true);
eq("meta owner client", canAccess("client", "/meta-ads/settings"), false);
eq("admin client", canAccess("client", "/admin"), false);
eq("data client", canAccess("client", "/api/data/summary"), false);
eq("template public", rolesForPath("/api/data/template"), null);
eq("home public", rolesForPath("/"), null);

console.log("\n3. Password login");
eq("owner password", roleForPassword("owner-pass", "owner-pass", "client-pass"), "owner");
eq("client password", roleForPassword("client-pass", "owner-pass", "client-pass"), "client");
eq("wrong password", roleForPassword("wrong", "owner-pass", "client-pass"), null);
eq("empty password", roleForPassword("", "owner-pass", "client-pass"), null);
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

console.log("\n8. Client-safe Meta summary");
const summary = publicClientSummary({
  connected: true, accountName: "ReachOut", permissions: [], tokenExpiresAt: null, lastSyncAt: null,
  connectedAt: null, adAccounts: [{ id: "act_1", accountId: "1", name: "Account", status: 1, currency: "INR" }],
  pages: [{ id: "p1", name: "Page" }], enabledAdAccounts: ["act_1"], expiresSoon: false, keyVersion: "v1",
});
const summaryText = JSON.stringify(summary).toLowerCase();
ok("no cost field", !/(cost|spend|budget|amount)/.test(summaryText));
ok("no token field", !summaryText.includes("token"));
ok("connected account only", summary.accountName === "ReachOut" && summary.adAccounts[0].name === "Account");

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

const turnstileSaved = process.env.TURNSTILE_ENABLED;
try {
  setEnv("TURNSTILE_ENABLED", undefined);
  ok("Turnstile off by default", turnstileEnabled() === false);
  ok("Turnstile off removes Cloudflare from CSP", !buildCsp("abc123").includes("challenges.cloudflare.com"));
  setEnv("TURNSTILE_ENABLED", "true");
  ok("Turnstile enabled when requested", turnstileEnabled() === true);
  ok("Turnstile enabled adds Cloudflare to CSP", buildCsp("abc123").includes("challenges.cloudflare.com"));
} finally {
  setEnv("TURNSTILE_ENABLED", turnstileSaved);
}

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
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  CLIENT_PASSWORD: process.env.CLIENT_PASSWORD,
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
  META_APP_ID: process.env.META_APP_ID,
  META_APP_SECRET: process.env.META_APP_SECRET,
  TURNSTILE_ENABLED: process.env.TURNSTILE_ENABLED,
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
};
try {
  setEnv("ADMIN_PASSWORD", "owner-shared");
  setEnv("CLIENT_PASSWORD", "owner-shared");
  ok("equal passwords refuse startup", secretProblems().includes("ADMIN_PASSWORD and CLIENT_PASSWORD must be different"));
  setEnv("ADMIN_PASSWORD", "owner-only");
  setEnv("CLIENT_PASSWORD", "client-only");
  ok("different passwords pass startup", !secretProblems().includes("ADMIN_PASSWORD and CLIENT_PASSWORD must be different"));

  setEnv("ADMIN_SESSION_SECRET", "x".repeat(32));
  setEnv("MONGODB_URI", "mongodb://example.invalid/reachout");
  setEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32).toString("base64"));
  setEnv("CRON_SECRET", "cron-test-value");
  setEnv("TURNSTILE_ENABLED", undefined);
  eq("minimal required env passes startup", secretProblems(), []);

  setEnv("META_APP_ID", undefined);
  setEnv("META_APP_SECRET", undefined);
  setEnv("ADMIN_SESSION_SECRET", startupEnv.ADMIN_SESSION_SECRET ?? "x".repeat(32));
  const metaProblems = secretProblems().filter((p) => p.startsWith("META_APP_ID") || p.startsWith("META_APP_SECRET"));
  eq("missing Meta does not block startup", metaProblems, []);
  ok("missing Meta disables Meta OAuth", metaConfigured() === false);
  const warning = metaConfigWarning();
  ok("missing Meta warning names both vars", !!warning && warning.includes("META_APP_ID") && warning.includes("META_APP_SECRET"));
  setEnv("META_APP_ID", "test-app-id");
  setEnv("META_APP_SECRET", "test-app-secret");
  ok("configured Meta enables Meta OAuth", metaConfigured() === true);
  eq("configured Meta has no warning", metaConfigWarning(), null);

  setEnv("TURNSTILE_ENABLED", "true");
  setEnv("TURNSTILE_SECRET_KEY", undefined);
  setEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", undefined);
  ok("enabled Turnstile requires both keys", turnstileConfigProblems().length === 2);
  setEnv("TURNSTILE_ENABLED", undefined);
  eq("disabled Turnstile needs no keys", turnstileConfigProblems(), []);
} finally {
  for (const [key, value] of Object.entries(startupEnv)) setEnv(key, value);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
