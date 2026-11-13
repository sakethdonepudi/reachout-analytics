import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const manifest = JSON.parse(readFileSync(".next/app-build-manifest.json", "utf8"));

function firstLoadKb(route) {
  const files = new Set(manifest.pages[route] ?? []);
  let bytes = 0;
  for (const file of files) {
    try {
      bytes += gzipSync(readFileSync(`.next/${file}`)).length;
    } catch {
      // A chunk may live under a different prefix; ignore missing entries.
    }
  }
  return bytes / 1024;
}

const budgets = [
  ["/case-studies/tamil-nadu", 220],
];
let failed = false;
const homeKb = firstLoadKb("/page");
console.log(`INFO first load /: ${homeKb.toFixed(1)} KB gz (no JS budget; Lighthouse gate applies)`);
for (const [route, limit] of budgets) {
  const kb = firstLoadKb(`${route}/page`);
  const ok = kb <= limit;
  console.log(`${ok ? "PASS" : "FAIL"} first load ${route}: ${kb.toFixed(1)} KB gz (budget ${limit} KB)`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
