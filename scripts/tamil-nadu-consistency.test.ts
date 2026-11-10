/* Tamil Nadu data-consistency tests. Run with --conditions react-server. */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { TVK_ACTUAL_SEATS, TVK_FORECASTERS } from "@/lib/tamil-nadu/forecasters";
import { TN_OPINION_POLL } from "@/lib/tamil-nadu/comparison";
import { TN_SEAT_GROUPS } from "@/lib/tamil-nadu/model";

let pass = 0, fail = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
function eq(name: string, got: unknown, want: unknown) {
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...filesUnder(path));
    else if (path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

console.log("\n1. Forecaster table");
eq("11 forecaster rows", TVK_FORECASTERS.length, 11);
const reachout = TVK_FORECASTERS.find((row) => row.forecaster === "ReachOut Analytics (opinion poll)");
ok("ReachOut row exists", Boolean(reachout));
eq("ReachOut projected seats", reachout?.projectedSeats, 106);
eq("ReachOut seats off", reachout?.differenceFromActual, 2);
eq("ReachOut rank", reachout?.rank, 2);
eq("ReachOut call", reachout?.winnerCall, "TVK ✓");
eq("actual reference", TVK_ACTUAL_SEATS, 108);
eq("ranks and ties unchanged", TVK_FORECASTERS.map((row) => row.rank), [1, 2, 3, 4, 5, 6, 6, 8, 9, 9, 11]);

console.log("\n2. Opinion poll seats");
eq("opinion seats", TN_OPINION_POLL.seats, { TVK: 106, "AIADMK+BJP+PMK+AMMK": 51, "DMK+INC+VCK": 77 });
eq("opinion seats total", TN_SEAT_GROUPS.reduce((sum, group) => sum + (TN_OPINION_POLL.seats?.[group] ?? 0), 0), 234);
eq("source file", TN_OPINION_POLL.sourceFile, "SAKET_TN_District_Estimate_opinion.xlsx");
eq("sha256", TN_OPINION_POLL.sha256, "c86dd033e4c87b6341ca1990ff67e55194f2371b35fbb8752fee8e7883e82583");

console.log("\n3. Calibrated seats stay out of the UI");
const uiFiles = [
  ...filesUnder("components/case-studies/tamil-nadu"),
  ...filesUnder("app/case-studies/tamil-nadu"),
];
const forbidden = ["finalSeats", "modelSeats"];
const hits = uiFiles.flatMap((file) => forbidden.filter((needle) => readFileSync(file, "utf8").includes(needle)).map((needle) => `${file}: ${needle}`));
eq("no UI component reads calibrated seats", hits, []);
const removedStrings = ["115", "33.8", "34.8", "age-weighted", "104,391"];
const textHits = uiFiles.flatMap((file) => removedStrings.filter((needle) => readFileSync(file, "utf8").includes(needle)).map((needle) => `${file}: ${needle}`));
eq("no removed opinion figures in the UI", textHits, []);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
