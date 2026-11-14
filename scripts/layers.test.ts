/* Layering token guard. Run: npx tsx scripts/layers.test.ts */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` - ${detail}` : ""}`); }
}
function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...filesUnder(path));
    else if (/\.(tsx|ts)$/.test(name)) out.push(path);
  }
  return out;
}

const css = readFileSync("app/globals.css", "utf8");
console.log("1. Layering scale");
const tokens: [string, number][] = [
  ["--z-nav", 50], ["--z-dropdown", 60], ["--z-analysis", 100],
  ["--z-drawer", 200], ["--z-modal", 300], ["--z-toast", 400], ["--z-loader", 500],
];
for (const [token, value] of tokens) ok(`${token} is ${value}`, css.includes(`${token}: ${value};`));

console.log("2. Tokens in use");
ok("analysis uses the analysis layer", readFileSync("components/case-studies/shared/analysis-shell.tsx", "utf8").includes("var(--z-analysis)"));
ok("dialog uses drawer and modal layers", readFileSync("components/ui/dialog.tsx", "utf8").includes("var(--z-drawer)") && readFileSync("components/ui/dialog.tsx", "utf8").includes("var(--z-modal)"));
ok("loader uses the loader layer", css.includes("z-index: var(--z-loader);"));
ok("navigation uses nav and dropdown layers", readFileSync("components/site/nav-core.tsx", "utf8").includes("var(--z-nav)") && readFileSync("components/site/nav-core.tsx", "utf8").includes("var(--z-dropdown)"));

console.log("3. No raw numeric z classes");
const components = filesUnder("components");
const hits = components.filter((file) => /z-\[\d+\]/.test(readFileSync(file, "utf8")));
ok("no z-[NN] in components", hits.length === 0, hits.join(", "));

console.log("4. Dialog stack and inert");
const dialog = readFileSync("components/ui/dialog.tsx", "utf8");
ok("dialog acquires and releases a layer", dialog.includes("acquireDialogLayer") && dialog.includes("releaseDialogLayer"));
ok("dialog only handles keys when topmost", dialog.includes("isTopDialogLayer"));
ok("analysis shell is inert with a dialog open", readFileSync("components/case-studies/shared/analysis-shell.tsx", "utf8").includes("data-analysis-shell") && readFileSync("components/case-studies/shared/analysis-shell.tsx", "utf8").includes("inert={dialogCount > 0"));
ok("scroll lock is reference counted", readFileSync("lib/overlay-layers.ts", "utf8").includes("scrollLocks"));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
