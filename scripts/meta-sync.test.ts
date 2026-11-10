/* Meta sync regression tests. Run: npx tsx scripts/meta-sync.test.ts */

import {
  connectionExpiresAt,
  expiresWithinHour,
  formatInr,
  isConnectionExpired,
  isRateLimited,
  minorToPaise,
  rangeReach,
  retryDelayMs,
  toPaise,
} from "@/lib/meta/insights";

let pass = 0, fail = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
function eq(name: string, got: unknown, want: unknown) {
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}

console.log("\n1. Paise conversion");
eq("decimal string to paise", toPaise("12.34"), 1234);
eq("zero", toPaise("0"), 0);
eq("missing", toPaise(null), null);
eq("account minor units", minorToPaise("1234"), 1234);
eq("lakh display", formatInr(123450000), "₹12.35L");
eq("crore display", formatInr(12345000000), "₹12.35Cr");

console.log("\n2. 12-hour connection lifetime");
const connectedAt = "2026-11-11T10:00:00.000Z";
eq("expires exactly 12 hours later", connectionExpiresAt(connectedAt), "2026-11-11T22:00:00.000Z");
ok("fresh connection is not expired", !isConnectionExpired(connectionExpiresAt(connectedAt), new Date("2026-11-11T21:59:00.000Z").getTime()));
ok("expired after 12 hours", isConnectionExpired(connectionExpiresAt(connectedAt), new Date("2026-11-11T22:00:01.000Z").getTime()));
ok("expires within one hour", expiresWithinHour(connectionExpiresAt(connectedAt), new Date("2026-11-11T21:30:00.000Z").getTime()));
ok("not within one hour", !expiresWithinHour(connectionExpiresAt(connectedAt), new Date("2026-11-11T20:30:00.000Z").getTime()));

console.log("\n3. Reach is not additive");
eq("range reach uses the all_days row", rangeReach({ reach: 1000 }, [{ reach: 600 }, { reach: 600 }]), 1000);
eq("missing range reach is null, never a daily sum", rangeReach(null, [{ reach: 600 }, { reach: 600 }]), null);

console.log("\n4. Rate-limit backoff");
eq("retry-after wins", retryDelayMs({ retryAfter: "2" }, 0), 2000);
ok("rate-limit codes are recognised", isRateLimited(4) && isRateLimited(17) && isRateLimited(32) && isRateLimited(613));
ok("normal error code is not rate limited", !isRateLimited(1));
ok("high usage produces a positive delay", retryDelayMs({ usage: JSON.stringify({ x: [{ call_count: 95 }] }) }, 0) > 0);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
