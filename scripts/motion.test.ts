/* Motion token and guardrail checks. Run: npx tsx scripts/motion.test.ts */
import { readFileSync } from "node:fs";
import { DUR, EASE, SPRING, tierForPath } from "../lib/motion";

let pass = 0, fail = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` - ${detail}` : ""}`); }
}

const css = readFileSync("app/globals.css", "utf8");

console.log("1. Durations and easing");
ok("instant is 80ms", DUR.instant === 80);
ok("fast is 140ms", DUR.fast === 140);
ok("base is 200ms", DUR.base === 200);
ok("slow is 280ms", DUR.slow === 280);
ok("hero is 600ms", DUR.hero === 600);
ok("out easing is slow-out", EASE.out === "cubic-bezier(.2,.8,.2,1)");
ok("in easing is slow-in", EASE.in === "cubic-bezier(.4,0,1,1)");
ok("in-out easing", EASE.inOut === "cubic-bezier(.65,0,.35,1)");
ok("one spring preset", SPRING.stiffness === 420 && SPRING.damping === 32);

console.log("2. CSS tokens");
for (const [name, value] of [["--dur-instant", "80ms"], ["--dur-fast", "140ms"], ["--dur-base", "200ms"], ["--dur-slow", "280ms"], ["--dur-hero", "600ms"], ["--ease-out", "cubic-bezier(.2,.8,.2,1)"]]) {
  ok(`${name} is ${value}`, css.includes(`${name}: ${value}`));
}
ok("reduced motion zeroes the tokens", /prefers-reduced-motion: reduce\)[\s\S]{0,400}--dur-hero: 0ms/.test(css));
ok("reduced motion caps opacity fades", css.includes("animation-duration: 0.01ms") && css.includes("transition-duration: 0.01ms"));

console.log("3. Frequency tiers");
ok("marketing is tier A", tierForPath("/") === "a");
ok("case studies are tier B", tierForPath("/case-studies/tamil-nadu") === "b");
ok("dashboard is tier C", tierForPath("/dashboard") === "c");
ok("account is tier C", tierForPath("/account/users") === "c");
ok("tier C disables entrance motion", css.includes('html[data-motion-tier="c"] .reveal'));

console.log("4. Guardrails");
ok("hidden tabs pause animation", css.includes('html[data-hidden="true"] *'));
ok("press scale is 0.97", css.includes(".pressable:active { transform: scale(.97); }"));
ok("no layout-property transitions in tokens", !/transition[^;]*(width|height|top|left)/.test(css.slice(css.indexOf("--dur-instant"), css.indexOf("--dur-instant") + 1200)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
