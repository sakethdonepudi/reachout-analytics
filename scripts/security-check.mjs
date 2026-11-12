#!/usr/bin/env node
/* Security checks: dependency audit, env ignore, source maps and a tracked-file secret scan. */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

let failures = 0;
const report = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

// 1. npm audit (high/critical). xlsx has no upstream fix; postcss is nested in
// Next and needs a breaking Next major. Both are reported as residual risk.
const ALLOWED = new Set(["xlsx", "postcss"]);
try {
  const raw = execFileSync("npm", ["audit", "--omit=dev", "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const audit = JSON.parse(raw);
  const high = Object.entries(audit.vulnerabilities ?? {}).filter(([name, v]) => ["high", "critical"].includes(v.severity));
  const unallowed = high.filter(([name]) => !ALLOWED.has(name));
  report(unallowed.length === 0, "npm audit high/critical", unallowed.length ? unallowed.map(([n, v]) => `${n}:${v.severity}`).join(", ") : `allowed residual: ${high.map(([n]) => n).join(", ") || "none"}`);
} catch (error) {
  // npm audit exits nonzero when it finds vulnerabilities; parse stdout if present.
  const out = String(error?.stdout ?? "");
  try {
    const audit = JSON.parse(out);
    const high = Object.entries(audit.vulnerabilities ?? {}).filter(([name, v]) => ["high", "critical"].includes(v.severity));
    const unallowed = high.filter(([name]) => !ALLOWED.has(name));
    report(unallowed.length === 0, "npm audit high/critical", unallowed.length ? unallowed.map(([n]) => n).join(", ") : `allowed residual: ${high.map(([n]) => n).join(", ") || "none"}`);
  } catch {
    report(false, "npm audit", "could not parse audit output");
  }
}

// 2. Env files ignored.
try {
  execFileSync("git", ["check-ignore", "-q", ".env.local"], { stdio: "ignore" });
  report(true, ".env.local is gitignored");
} catch { report(false, ".env.local is gitignored"); }

// 3. Source maps disabled.
const nextConfig = readFileSync("next.config.ts", "utf8");
report(nextConfig.includes("productionBrowserSourceMaps: false"), "productionBrowserSourceMaps is off");

// 4. Dev auth bypass absent.
let bypass = "";
try {
  bypass = execFileSync("git", ["grep", "-n", "process.env.CASE_STUDY_DEV_BYPASS", "--", ":!scripts/security-check.mjs", ":!scripts/security.test.ts"], { encoding: "utf8" }).trim();
} catch (error) {
  if (error?.status !== 1) throw error;
}
report(bypass.length === 0, "no CASE_STUDY_DEV_BYPASS in tracked files");

// 5. Tracked-file secret scan (equivalent to a lightweight gitleaks pass).
const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter((f) => f && f !== ".env.example" && !f.startsWith(".context/") && !f.startsWith("node_modules/") && !f.startsWith("scripts/security-"));
const secretPatterns = [
  /mongodb(?:\+srv)?:\/\/[^\s<"']+:[^\s<"']+@/i,
  /(?:TOKEN_ENCRYPTION_KEY|META_APP_SECRET|ADMIN_SESSION_SECRET)\s*=\s*["']?(?!\[SENSITIVE\]|$)[^\s#"']{6,}/,
  /(?:sk_live_|AIza[0-9A-Za-z_-]{35})/,
];
const hits = [];
for (const file of files) {
  if (!existsSync(file)) continue;
  let text = "";
  try { text = readFileSync(file, "utf8"); } catch { continue; }
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) { hits.push(file); break; }
  }
}
report(hits.length === 0, "no tracked secrets found", hits.slice(0, 8).join(", "));

// 6. Gitleaks is optional; the tracked-file scan above is the equivalent check.
console.log("• gitleaks optional — built-in tracked-file secret scan used");


// 6b. Storage and header policy.
try {
  const sourceFiles = [];
  for (const root of ["app", "components", "lib"]) {
    for (const file of walkSource(root)) if (/\.(ts|tsx)$/.test(file)) sourceFiles.push(file);
  }
  const riskyStorage = sourceFiles.filter((file) => {
    const text = readFileSync(file, "utf8");
    return /(localStorage|sessionStorage|indexedDB)[^\n]{0,160}(token|secret|password|totp|spend|payment|amount|budget)/i.test(text);
  });
  report(riskyStorage.length === 0, "no sensitive browser storage", riskyStorage.slice(0, 5).join(", "));
  const security = readFileSync("lib/security.ts", "utf8");
  const headerChecks = [
    ["HSTS", security.includes("max-age=63072000") && security.includes("includeSubDomains")],
    ["no-referrer", security.includes('"Referrer-Policy": "no-referrer"')],
    ["nosniff", security.includes('"X-Content-Type-Options": "nosniff"')],
    ["COOP/CORP", security.includes('"Cross-Origin-Opener-Policy": "same-origin"') && security.includes('"Cross-Origin-Resource-Policy": "same-origin"')],
    ["permissions usb", security.includes("usb=()")],
    ["CSP frame-ancestors", security.includes("frame-ancestors 'none'")],
    ["CSP object-src", security.includes("object-src 'none'")],
    ["CSP base-uri", security.includes("base-uri 'none'")],
    ["CSP upgrade", security.includes("upgrade-insecure-requests")],
  ];
  for (const [name, ok] of headerChecks) report(ok, `header policy: ${name}`);
} catch (error) {
  report(false, "storage and header policy", error instanceof Error ? error.message : String(error));
}

// 7. Static-chunk leak scan (run after `npm run build`).
import { readdirSync, statSync } from "node:fs";
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = `${dir}/${name}`;
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}
function walkSource(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = `${dir}/${name}`;
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walkSource(path));
    else out.push(path);
  }
  return out;
}

try {
  const files = walk(".next/static");
  const patterns = [
    { name: "Vivo", test: (t) => t.includes("Vivo") },
    { name: "medianPp", test: (t) => t.includes("medianPp") },
    { name: "changePp", test: (t) => t.includes("changePp") },
    { name: "crosswalk", test: (t) => t.includes("crosswalk") },
    { name: "sourceAudit", test: (t) => t.includes("sourceAudit") },
    { name: "tn-saket-v3", test: (t) => t.includes("tn-saket-v3") },
    { name: "10866/8866", test: (t) => /10866[\s\S]{0,200}8866|8866[\s\S]{0,200}10866/.test(t) },
    { name: "357118741", test: (t) => t.includes("357118741") },
    { name: "Axis My India", test: (t) => t.includes("Axis My India") },
    { name: "amount_spent", test: (t) => t.includes("amount_spent") },
    { name: "spend_cap", test: (t) => t.includes("spend_cap") },
    { name: "funding_source", test: (t) => t.includes("funding_source") },
  ];
  const hits = [];
  let scanned = 0;
  for (const file of files) {
    let text = "";
    try { text = readFileSync(file, "utf8"); } catch { continue; }
    scanned++;
    for (const pattern of patterns) if (pattern.test(text)) hits.push(`${file}: ${pattern.name}`);
  }
  report(hits.length === 0, `static chunk data scan (${scanned} files)`, hits.slice(0, 20).join(", "));
} catch {
  report(false, "static chunk data scan", "run npm run build first");
}

console.log(failures ? `\n${failures} security check(s) failed` : "\nAll security checks passed");
if (failures) process.exitCode = 1;
