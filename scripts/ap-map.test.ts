/* Andhra Pradesh map gate: every survey district and AC resolves to one polygon. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AP_ACS, AP_DISTRICTS } from "@/lib/andhra-pradesh/survey-map";
import { canonicalApAcName, canonicalApDistrict, splitApAcLabel } from "@/lib/andhra-pradesh/aliases";

let pass = 0, fail = 0;
function check(name: string, run: () => void) {
  try { run(); pass++; console.log(`  ✓ ${name}`); }
  catch (error) { fail++; console.log(`  ✗ ${name}: ${error instanceof Error ? error.message : error}`); }
}

const names = JSON.parse(readFileSync("lib/data/andhra-pradesh/ap-survey-names.json", "utf8")) as { districts: Record<string, string[]>; acNames: string[] };
const acs = AP_ACS;
const districts = AP_DISTRICTS;
const namesInDistrict = new Map<string, Set<string>>();
for (const district of districts) {
  namesInDistrict.set(district, new Set(acs.filter((ac) => ac.district === district).map((ac) => canonicalApAcName(ac.name).toLowerCase())));
}

console.log("\n1. Map files");
check("175 assembly constituencies", () => assert.equal(acs.length, 175));
check("unique assembly numbers", () => assert.equal(new Set(acs.map((ac) => ac.no)).size, 175));
check("28 districts", () => assert.equal(districts.length, 28));
check("district AC totals equal 175", () => assert.equal(districts.reduce((sum, district) => sum + acs.filter((ac) => ac.district === district).length, 0), 175));

console.log("\n2. Survey names");
check("28 survey districts", () => assert.equal(Object.keys(names.districts).length, 28));
check("173 unique survey AC names for 175 seats", () => assert.equal(names.acNames.length, 173));
const unmatched: string[] = [];
for (const [district, list] of Object.entries(names.districts)) {
  const mapNames = namesInDistrict.get(canonicalApDistrict(district));
  if (!mapNames) { unmatched.push(`${district} (district missing)`); continue; }
  for (const name of list) if (!mapNames.has(canonicalApAcName(name).toLowerCase())) unmatched.push(`${district}/${name}`);
}
check("every survey AC resolves inside its district", () => assert.deepEqual(unmatched, []));
check("every survey district resolves", () => {
  for (const district of Object.keys(names.districts)) assert.ok(districts.includes(canonicalApDistrict(district)), district);
});

console.log("\n3. Numbered rows");
check("numbered demo labels resolve", () => {
  for (const label of ["001 Ichchapuram", "171 Kuppam", "123 Nellore City"]) {
    const parsed = splitApAcLabel(label);
    assert.ok(parsed.no != null && acs.some((ac) => ac.no === parsed.no), label);
  }
});

console.log(`\nAP MAP ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
