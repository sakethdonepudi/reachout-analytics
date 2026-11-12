/* Account, TOTP and scope tests. Run: npx tsx --conditions react-server scripts/accounts.test.ts */

import { checkPassword, passwordStrength } from "@/lib/password-policy";
import { generateTotpSecret, totpCode, totpStep, verifyTotp, normaliseRecoveryCode } from "@/lib/totp";
import { safeNextPath } from "@/lib/access";
import { scopeAllowsCase } from "@/lib/users";
import { buildCsp } from "@/lib/security";
import { turnstileConfigured, turnstileRequired } from "@/lib/turnstile";

let pass = 0, fail = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

console.log("\n1. Password policy");
ok("rejects short passwords", !checkPassword("short", "owner").ok);
ok("rejects common passwords", !checkPassword("password1234", "owner").ok);
ok("rejects the username", !checkPassword("owner-strong-pass", "owner").ok);
ok("accepts a strong password", checkPassword("Correct-Horse-2026!", "owner").ok);
ok("strength meter rises", passwordStrength("Correct-Horse-2026!") === 4);

console.log("\n2. TOTP RFC 6238");
const secret = generateTotpSecret();
const step = totpStep(Date.now());
const code = totpCode(secret, step);
ok("current code verifies", verifyTotp(secret, code, null).ok);
ok("replay is rejected", !verifyTotp(secret, code, step).ok);
ok("previous step is accepted once", verifyTotp(secret, totpCode(secret, step - 1), null).ok);
ok("wrong code is rejected", !verifyTotp(secret, "000000", null).ok || code === "000000");
ok("recovery codes normalise", normaliseRecoveryCode("abcd-2345") === "ABCD2345");

console.log("\n3. Open redirect");
const base = "https://internal.invalid";
ok("relative path accepted", safeNextPath("/dashboard", "owner") === "/dashboard");
ok("protocol-relative rejected", safeNextPath("//evil.example", "owner") === null);
ok("scheme rejected", safeNextPath("https://evil.example", "owner") === null);
ok("backslash rejected", safeNextPath("/\\evil", "owner") === null);
ok("login loop rejected", safeNextPath("/login?next=/dashboard", "owner") === null);
ok("out-of-role path rejected", safeNextPath("/dashboard", "client") === null);
ok("client case path accepted", safeNextPath("/case-studies/tamil-nadu", "client") === "/case-studies/tamil-nadu");

console.log("\n4. Client scope");
const scope = { caseStudies: ["tamil-nadu"], states: [], parties: [] };
ok("scoped case allowed", scopeAllowsCase("client", scope, { slug: "tamil-nadu", state: "Tamil Nadu", title: "Tamil Nadu" }));
ok("other case denied", !scopeAllowsCase("client", scope, { slug: "telangana", state: "Telangana", title: "Telangana" }));
ok("empty scope denies", !scopeAllowsCase("client", { caseStudies: [], states: [], parties: [] }, { slug: "tamil-nadu", state: "Tamil Nadu", title: "Tamil Nadu" }));
ok("owner bypasses scope", scopeAllowsCase("owner", null, { slug: "telangana", state: "Telangana", title: "Telangana" }));
ok("state scope allows", scopeAllowsCase("client", { caseStudies: [], states: ["Telangana"], parties: [] }, { slug: "telangana", state: "Telangana", title: "Telangana" }));
ok("party scope allows", scopeAllowsCase("client", { caseStudies: [], states: [], parties: ["TVK"] }, { slug: "unknown", state: "Tamil Nadu", title: "X", party: "TVK" }));

console.log("\n5. Turnstile and CSP");
ok("Turnstile is opt-in locally without keys", !turnstileConfigured() && !turnstileRequired());
const csp = buildCsp("nonce", { turnstile: true });
ok("Turnstile adds the script origin", csp.includes("https://challenges.cloudflare.com"));
ok("Turnstile adds the connect origin", /connect-src[^;]*challenges\.cloudflare\.com/.test(csp));
ok("no unsafe-inline scripts", !/script-src[^;]*'unsafe-inline'/.test(csp));
ok("frame-ancestors none", csp.includes("frame-ancestors 'none'"));
ok("object-src none", csp.includes("object-src 'none'"));
ok("upgrade-insecure-requests", csp.includes("upgrade-insecure-requests"));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
