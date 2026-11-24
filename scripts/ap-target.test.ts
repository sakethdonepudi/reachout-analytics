/**
 * Post-poll target-gap selection.
 *
 * The ring belongs on the rows furthest below the target party average for the
 * tab. This test fails when any ringed row has a smaller gap than an unringed
 * row in the same tab, which catches first-three-in-order and reversed sorts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSurveyHtml } from "@/lib/survey/parse";
import { AP_CONFIG } from "@/lib/case-study/config";
import { selectGapRows, type TargetGapRow } from "@/lib/survey/target-gaps";

let pass = 0;
const check = (name: string, fn: () => void) => { fn(); pass += 1; console.log(`  ✓ ${name}`); };

const weightedAverage = (rows: TargetGapRow[]) => {
  const total = rows.reduce((sum, row) => sum + row.n, 0);
  return total ? rows.reduce((sum, row) => sum + row.value * row.n, 0) / total : 0;
};

const assertNoSmallerRingedGap = (rows: TargetGapRow[], average: number, selected: Set<string>, label: string) => {
  const ringed = rows.filter((row) => selected.has(row.key)).map((row) => average - row.value);
  const unringed = rows.filter((row) => !selected.has(row.key)).map((row) => average - row.value);
  if (!ringed.length || !unringed.length) return;
  assert.ok(
    Math.min(...ringed) >= Math.max(...unringed) - 1e-9,
    `${label}: a ringed row has a smaller gap than an unringed row`,
  );
};

console.log("\n1. Synthetic selection");
const synthetic: TargetGapRow[] = [
  { key: "Uttarandhra", value: 28.03, n: 5109 },
  { key: "Godavari", value: 30.19, n: 6089 },
  { key: "Krishna", value: 31.17, n: 7888 },
  { key: "South Coastal", value: 23.17, n: 3284 },
  { key: "Rayalaseema", value: 24.05, n: 9523 },
];
check("picks the two largest below-average gaps, not the first three rows", () => {
  const selected = selectGapRows(synthetic, 27.53);
  assert.deepEqual([...selected].sort(), ["Rayalaseema", "South Coastal"]);
  assertNoSmallerRingedGap(synthetic, 27.53, selected, "synthetic");
});
check("ties break on larger sample size", () => {
  const selected = selectGapRows([{ key: "Small", value: 20, n: 10 }, { key: "Large", value: 20, n: 1000 }, { key: "Top", value: 30, n: 1 }], 25, 1);
  assert.deepEqual([...selected], ["Large"]);
});

const file = process.env.SURVEY_AP_HTML;
if (!file) {
  console.log("  - SURVEY_AP_HTML is not set; skipping the real-file checks");
} else {
  console.log("\n2. Real Andhra Pradesh file");
  const data = parseSurveyHtml(readFileSync(file, "utf8"), "andhra-pradesh-2024");
  const nda = data.parties.indexOf("NDA");
  const ysrcp = data.parties.indexOf("YSRCP");
  const gapTabs = AP_CONFIG.profileOrder.rd;
  for (const tab of gapTabs) {
    const demo = data.periods.rd?.demo?.[tab];
    if (!demo) continue;
    const rows: TargetGapRow[] = demo.rows.map((row) => ({ key: row.g, value: row.v[nda] ?? 0, n: row.n }));
    const average = weightedAverage(rows);
    const selected = selectGapRows(rows, average);
    assertNoSmallerRingedGap(rows, average, selected, tab);
    for (const row of rows.filter((item) => selected.has(item.key))) assert.ok(row.value < average, `${tab}: ringed row is not below average`);
  }
  check("every Post-poll tab passes the gap test", () => {});
  const zone = data.periods.rd?.demo?.zone;
  if (!zone) throw new Error("Zone profile is missing");
  const zoneRows: TargetGapRow[] = zone.rows.map((row) => ({ key: row.g, value: row.v[nda] ?? 0, n: row.n }));
  check("Zone rings South Coastal and Rayalaseema", () => {
    assert.deepEqual([...selectGapRows(zoneRows, weightedAverage(zoneRows))].sort(), ["Rayalaseema", "South Coastal"]);
  });
  const counts = (period: "op" | "ex") => AP_CONFIG.profileOrder[period].map((tab) => {
    const demo = data.periods[period]?.demo?.[tab];
    if (!demo) return 0;
    return demo.rows.filter((row) => {
      const value = row.v[ysrcp] ?? 0;
      return row.v.every((other, index) => index === ysrcp || value > other);
    }).length;
  });
  check("Opinion and Exit target counts are unchanged", () => {
    assert.deepEqual(counts("op"), [0, 0, 3, 35]);
    assert.deepEqual(counts("ex"), [0, 0, 2, 10]);
  });
}

console.log(`\nAP TARGET ${pass} passed`);
