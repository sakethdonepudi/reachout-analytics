/* Security regression tests. Run: npx tsx scripts/security.test.ts */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { canAccess, rolesForPath, safeNextPath } from "@/lib/access";
import { csrfCheck } from "@/lib/csrf";
import { verifyPkce, createPkce } from "@/lib/oauth-pkce";
import { isGoogleEmailVerified } from "@/lib/google-oauth";
import { signPayload, verifyPayload } from "@/lib/signed-cookie";
import { roleFromLists } from "@/lib/auth";
import { redact, maskEmail } from "@/lib/redact";
import { publicClientSummary } from "@/lib/meta/public";
import { metaConfigured } from "@/lib/meta/oauth";
import { buildCsp, PROTECTED_HEADERS } from "@/lib/security";
import { metaConfigWarning, secretProblems } from "@/lib/security-config";

let pass = 0, fail = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
function eq(name: string, got: unknown, want: unknown) {
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
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

console.log("\n3. CSRF");
const base = { origin: "https://app.example", siteOrigin: "https://app.example", headerToken: "a".repeat(32), cookieToken: "a".repeat(32) };
eq("valid POST", csrfCheck({ ...base, method: "POST" }), true);
eq("GET bypass", csrfCheck({ ...base, method: "GET", origin: "https://evil.example" }), true);
eq("wrong origin", csrfCheck({ ...base, method: "POST", origin: "https://evil.example" }), false);
eq("missing header", csrfCheck({ ...base, method: "POST", headerToken: null }), false);
eq("mismatch", csrfCheck({ ...base, method: "PATCH", cookieToken: "b".repeat(32) }), false);

console.log("\n4. OAuth PKCE and verified email");
const pkce = createPkce();
eq("PKCE verifier matches", verifyPkce(pkce.verifier, pkce.challenge), true);
eq("PKCE mismatch rejected", verifyPkce("wrong", pkce.challenge), false);
eq("unverified email rejected", isGoogleEmailVerified({ email_verified: false }), false);
eq("missing email_verified rejected", isGoogleEmailVerified({}), false);
eq("verified email accepted", isGoogleEmailVerified({ email_verified: true }), true);

console.log("\n4b. Signed OAuth state envelope");
const stateToken = signPayload({ state: "state-a", nonce: "nonce-b", verifier: "verifier-c" }, "test-secret", 10_000);
eq("state payload round-trips", verifyPayload<{ state: string }>(stateToken, "test-secret")?.state, "state-a");
eq("wrong secret rejected", verifyPayload(stateToken, "other-secret"), null);
eq("tampered signature rejected", verifyPayload(`${stateToken.slice(0, -1)}${stateToken.endsWith("x") ? "y" : "x"}`, "test-secret"), null);
eq("expired state rejected", verifyPayload(signPayload({ state: "old" }, "test-secret", -1), "test-secret"), null);

console.log("\n5. Allowlist");
const owners = ["Owner@Example.com"];
const envClients = ["client@example.com"];
const savedClients = ["saved@example.com"];
eq("owner case-insensitive", roleFromLists("OWNER@example.com", owners, envClients, savedClients), "owner");
eq("env client", roleFromLists("client@example.com", owners, envClients, savedClients), "client");
eq("saved client", roleFromLists("saved@example.com", owners, envClients, savedClients), "client");
eq("unknown rejected", roleFromLists("nobody@example.com", owners, envClients, savedClients), null);

console.log("\n6. Redaction");
const redacted = JSON.stringify(redact({
  token: "secret-token", nested: { authorization: "Bearer abc", password: "hunter2" },
  email: "person@example.com", cookie: "session=abc", safe: "visible",
}));
ok("token removed", !redacted.includes("secret-token"));
ok("authorization removed", !redacted.includes("Bearer abc"));
ok("password removed", !redacted.includes("hunter2"));
ok("email masked", redacted.includes(maskEmail("person@example.com")) && !redacted.includes("person@example.com"));
ok("safe value kept", redacted.includes("visible"));

console.log("\n7. Client-safe Meta summary");
const summary = publicClientSummary({
  connected: true, accountName: "ReachOut", permissions: [], tokenExpiresAt: null, lastSyncAt: null,
  connectedAt: null, adAccounts: [{ id: "act_1", accountId: "1", name: "Account", status: 1, currency: "INR" }],
  pages: [{ id: "p1", name: "Page" }], enabledAdAccounts: ["act_1"], expiresSoon: false, keyVersion: "v1",
});
const summaryText = JSON.stringify(summary).toLowerCase();
ok("no cost field", !/(cost|spend|budget|amount)/.test(summaryText));
ok("no token field", !summaryText.includes("token"));
ok("connected account only", summary.accountName === "ReachOut" && summary.adAccounts[0].name === "Account");

console.log("\n8. Security headers");
const csp = buildCsp("abc123");
ok("default-src self", csp.includes("default-src 'self'"));
ok("nonce present", csp.includes("'nonce-abc123'"));
ok("frame-ancestors none", csp.includes("frame-ancestors 'none'"));
ok("object-src none", csp.includes("object-src 'none'"));
ok("script-src does not allow unsafe-inline", !/script-src[^;]*'unsafe-inline'/.test(csp));
eq("protected cache control", PROTECTED_HEADERS["Cache-Control"], "private, no-store, max-age=0");
eq("protected vary", PROTECTED_HEADERS.Vary, "Cookie");

console.log("\n9. No dev auth bypass in shipping code");
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

console.log("\n10. Meta is optional at startup");
const metaEnv = {
  META_APP_ID: process.env.META_APP_ID,
  META_APP_SECRET: process.env.META_APP_SECRET,
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
};
const setEnv = (key: string, value: string | undefined) => {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
};
try {
  setEnv("META_APP_ID", undefined);
  setEnv("META_APP_SECRET", undefined);
  setEnv("ADMIN_SESSION_SECRET", metaEnv.ADMIN_SESSION_SECRET ?? "x".repeat(32));
  const metaProblems = secretProblems().filter((p) => p.startsWith("META_APP_ID") || p.startsWith("META_APP_SECRET"));
  eq("missing Meta does not block startup", metaProblems, []);
  ok("missing Meta disables Meta OAuth", metaConfigured() === false);
  const warning = metaConfigWarning();
  ok("missing Meta warning names both vars", !!warning && warning.includes("META_APP_ID") && warning.includes("META_APP_SECRET"));
  setEnv("META_APP_ID", "test-app-id");
  setEnv("META_APP_SECRET", "test-app-secret");
  ok("configured Meta enables Meta OAuth", metaConfigured() === true);
  eq("configured Meta has no warning", metaConfigWarning(), null);
} finally {
  setEnv("META_APP_ID", metaEnv.META_APP_ID);
  setEnv("META_APP_SECRET", metaEnv.META_APP_SECRET);
  setEnv("ADMIN_SESSION_SECRET", metaEnv.ADMIN_SESSION_SECRET);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
