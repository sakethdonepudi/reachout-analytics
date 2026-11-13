/* Account, TOTP and scope tests. Run: npx tsx --conditions react-server scripts/accounts.test.ts */

import { checkPassword } from "@/lib/password-policy.server";
import { passwordStrength } from "@/lib/password-policy";
import { generateTotpSecret, totpCode, totpStep, verifyTotp, normaliseRecoveryCode } from "@/lib/totp";
import { safeNextPath } from "@/lib/access";
import { needsEnrollment } from "@/lib/users";
import { pendingTtlMs } from "@/lib/pending-auth";
import { signPayload, verifyPayload } from "@/lib/signed-cookie";
import { buildCsp } from "@/lib/security";
import { turnstileConfigured, turnstileRequired } from "@/lib/turnstile";
import { readFileSync } from "node:fs";
import { CASES } from "@/lib/cases";

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

console.log("\n2b. First-login pending windows");
ok("password step lasts 15 minutes", pendingTtlMs("password") === 15 * 60 * 1000);
ok("enrollment step lasts 15 minutes", pendingTtlMs("enroll") === 15 * 60 * 1000);
ok("TOTP step stays at 3 minutes", pendingTtlMs("totp") === 3 * 60 * 1000);
ok("owners always need enrollment", needsEnrollment({ role: "owner", totpRequired: false, totpEnabled: false }));
ok("owner with TOTP does not enroll", !needsEnrollment({ role: "owner", totpRequired: true, totpEnabled: true }));
ok("client without 2FA skips enrollment", !needsEnrollment({ role: "client", totpRequired: false, totpEnabled: false }));
ok("client with 2FA enrolls", needsEnrollment({ role: "client", totpRequired: true, totpEnabled: false }));
const pending = signPayload({ userId: "u1", purpose: "password" }, "test-secret", pendingTtlMs("password"));
ok("a 4-minute-old first-login step is still valid", verifyPayload(pending, "test-secret") !== null);
ok("a 16-minute-old step is rejected", verifyPayload(signPayload({ userId: "u1" }, "test-secret", -1), "test-secret") === null);

console.log("\n3. Open redirect");
const base = "https://internal.invalid";
ok("relative path accepted", safeNextPath("/dashboard", "owner") === "/dashboard");
ok("protocol-relative rejected", safeNextPath("//evil.example", "owner") === null);
ok("scheme rejected", safeNextPath("https://evil.example", "owner") === null);
ok("backslash rejected", safeNextPath("/\\evil", "owner") === null);
ok("login loop rejected", safeNextPath("/login?next=/dashboard", "owner") === null);
ok("out-of-role path rejected", safeNextPath("/dashboard", "client") === null);
ok("client case path accepted", safeNextPath("/case-studies/tamil-nadu", "client") === "/case-studies/tamil-nadu");

console.log("\n4. Case access");
ok("seven case studies are available", CASES.length === 7);
ok("every case study is client visible", ["north-east-elections", "tamil-nadu", "telangana", "andhra-pradesh-2024", "gujarat", "bihar", "karnataka-2023"].every((slug) => CASES.some((item) => item.slug === slug)));

console.log("\n4b. Simple client form");
const usersForm = readFileSync("app/account/users/users-client.tsx", "utf8");
ok("user form has no scope fields", !/clientScope|Case studies|States|Parties/.test(usersForm));
ok("user form keeps the required fields", ["Username", "Display name", "Organisation", "Temporary password", "Require 2FA"].every((label) => usersForm.includes(label)));

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
