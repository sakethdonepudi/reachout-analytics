/* =====================================================================
   PIN pipeline + assumed-PIN scenario audit.

   Run: npx tsx scripts/pin-audit.test.ts

   Uses synthetic datasets with KNOWN PIN values. It never touches MongoDB
   and never writes to the published survey. Section 10 runs a full
   preview → commit → filtering → aggregation → Excel-export harness against a
   separate in-memory "test case study" (id: pin-audit-test).
   ===================================================================== */

import * as XLSX from "xlsx";
import { parseWorkbook, validateSheet, buildWorkbook, type Row } from "@/lib/poll-data";
import { toDoc, assemblePinAggregates, buildRecordsQuery, type PinGroupRow } from "@/lib/poll-store";
import { normalizePin, classifyPin, resolveRowPin, candidatePinsForDistrict } from "@/lib/pin";
import { allocatePinAssignments, summarizeAllocation, PIN_ALLOCATION_VERSION, PIN_BASIS_LABEL, type AllocInput } from "@/lib/pin-assign";
import { POSTAL_REFERENCE } from "@/lib/data/tamil-nadu-pincodes";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
function eq(name: string, got: unknown, want: unknown) {
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}
const canon = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function sheet(headers: string[], rows: unknown[][]) {
  return XLSX.utils.aoa_to_sheet([headers, ...rows]);
}
function workbook(opinionRows: unknown[][], opinionHeaders: string[], exitRows: unknown[][], exitHeaders: string[]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(opinionHeaders, opinionRows), "Opinion Poll");
  XLSX.utils.book_append_sheet(wb, sheet(exitHeaders, exitRows), "Exit Poll");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/* ---- 1. pure normalisation / classification ------------------------- */
console.log("\n1. Normalisation & 6-digit validation");
eq("numeric cell 600002 → '600002'", normalizePin(600002), "600002");
eq("leading-zero text preserved", normalizePin("060001"), "060001");
eq("whitespace collapsed", normalizePin(" 600 004 "), "600004");
eq("excel text marker stripped", normalizePin("'600001"), "600001");
eq("full-width digits folded", normalizePin("６００００１"), "600001");
eq("numeric trailing .0 dropped", normalizePin("600001.0"), "600001");
eq("classify numeric", classifyPin(600002).format, "ok");
eq("classify blank", classifyPin("").format, "blank");
eq("classify 5-digit", classifyPin("12345").format, "invalid");
eq("classify letters", classifyPin("abc").format, "invalid");

/* ---- 2. header alias mapping ---------------------------------------- */
console.log("\n2. Header alias mapping (PIN Code / PINCode / Pincode / Postal Code)");
const exitHeaders = ["Response ID", "Party", "District", "PIN Code"];
const exitRows: unknown[][] = [
  ["E1", "TVK", "Chennai", "600001"],
  ["E2", "DMK+INC+VCK", "Chennai", 600002],
  ["E3", "TVK", "Coimbatore", "060001"],
  ["E4", "NTK", "Chennai", " 600 004 "],
  ["E5", "Others", "Salem", "12345"],
  ["E6", "TVK", "Erode", ""],
  ["E7", "TVK", "Erode", "abc"],
  ["E8", "TVK", "Chennai", "641001"],
];
const opinionHeaders = ["Response ID", "Party", "District", "Postal Code"];
const opinionRows: unknown[][] = [
  ["O1", "TVK", "Madurai", "625001"],
  ["O2", "DMK+INC+VCK", "Madurai", 625002],
];
const parsed = parseWorkbook(workbook(opinionRows, opinionHeaders, exitRows, exitHeaders));
ok("parse produces no structural errors", parsed.errors.filter((e) => e.severity === "error").length === 0, JSON.stringify(parsed.errors));
ok("canonical 'PIN Code' added for alias sheet (Postal Code)", parsed.sheets.opinion.every((r) => "PIN Code" in r));
eq("alias value carried to canonical", parsed.sheets.opinion[0]["PIN Code"], "625001");
eq("leading-zero PIN preserved as text", parsed.sheets.exit[2]["PIN Code"], "060001");
eq("numeric PIN stored as text", parsed.sheets.exit[1]["PIN Code"], "600002");
eq("whitespace PIN normalised", parsed.sheets.exit[3]["PIN Code"], "600004");

/* ---- 3. validation: format vs geographic mapping -------------------- */
console.log("\n3. Validation (format separate from geographic mapping)");
const ev = validateSheet("Exit Poll", parsed.sheets.exit);
eq("pinOk", ev.pinOk, 5);
eq("pinInvalid", ev.pinInvalid, 2);
eq("pinBlank", ev.pinBlank, 1);
eq("pinConflicts", ev.pinConflicts, 0);
eq("pinLocationKnown (in reference)", ev.pinLocationKnown, 4);
eq("pinLocationUnknown (not in reference, still format-valid)", ev.pinLocationUnknown, 1);
eq("pinMismatch (PIN ref district ≠ stated district)", ev.pinMismatch, 1);

/* ---- 4. conflicting columns ---------------------------------------- */
console.log("\n4. Conflicting PIN columns are detected, not overwritten");
const conflictWb = workbook([], ["Response ID", "Party", "PIN Code"], [["C1", "TVK", "600001", "600002"], ["C2", "TVK", "600001", ""]], ["Response ID", "Party", "PIN Code", "Pincode"]);
const cparsed = parseWorkbook(conflictWb);
ok("conflict reported as an error", cparsed.errors.some((e) => e.field === "PIN Code" && e.severity === "error"));
const cRow = cparsed.sheets.exit[0] as Row;
ok("row left untouched on conflict", cRow["PIN Code"] === "600001" && cRow["Pincode"] === "600002");
eq("conflict row resolves as conflict", resolveRowPin(cRow).conflict, true);

/* ---- 5. storage mapping --------------------------------------------- */
console.log("\n5. Storage mapping (Mongo document fields)");
const doc = toDoc(parsed.sheets.exit[2] as Row, "tamil-nadu", "exit", "imp1");
eq("stored pin preserved as text", doc.pin, "060001");
eq("stored pinNormalized", doc.pinNormalized, "060001");
eq("stored pinFormat", doc.pinFormat, "ok");
eq("stored pinLocationKnown false when unknown", doc.pinLocationKnown, false);
eq("stored pinRefDistrict for known PIN", toDoc(parsed.sheets.exit[0] as Row, "tamil-nadu", "exit", "imp1").pinRefDistrict, "Chennai");
eq("blank pin stored empty", toDoc(parsed.sheets.exit[5] as Row, "tamil-nadu", "exit", "imp1").pin, "");

/* ---- 6. export preserves supplied PINs ------------------------------ */
console.log("\n6. Excel export preserves supplied PIN codes");
const outBuf = buildWorkbook([], parsed.sheets.exit as Row[], exitHeaders);
const reparsed = XLSX.read(outBuf, { type: "buffer" });
const outRows = XLSX.utils.sheet_to_json<Row>(reparsed.Sheets["Exit Poll"], { defval: "", raw: true });
eq("exported leading-zero PIN preserved", outRows[2]["PIN Code"], "060001");
eq("exported numeric PIN as text", outRows[1]["PIN Code"], "600002");
ok("all exported PIN values are strings", outRows.every((r) => typeof r["PIN Code"] === "string"));

/* ---- 7. aggregation assembly ---------------------------------------- */
console.log("\n7. PIN aggregation assembly");
const grouped: PinGroupRow[] = [
  { _id: { pin: "600001", status: "valid", party: "TVK", district: "Chennai" }, n: 3 },
  { _id: { pin: "600001", status: "valid", party: "DMK+INC+VCK", district: "Chennai" }, n: 1 },
  { _id: { pin: "", status: "valid", party: "TVK", district: "Erode" }, n: 10 },
  { _id: { pin: "12345", status: "valid", party: "TVK", district: "Salem" }, n: 2 },
  { _id: { pin: "625001", status: "blank", party: "", district: "Madurai" }, n: 4 },
];
const agg = assemblePinAggregates(grouped);
eq("total responses", agg.total, 20);
eq("valid responses", agg.valid, 16);
eq("withPin", agg.withPin, 10);
eq("withoutPin retained in totals", agg.withoutPin, 10);
eq("invalidPinResponses", agg.invalidPinResponses, 2);
eq("usable PIN buckets", agg.pins.length, 2);
ok("no bucket fabricated for invalid 5-digit PIN", !agg.pins.some((p) => p.pin === "12345"));

/* ---- 8. records filter ---------------------------------------------- */
console.log("\n8. Records filter — PIN normalisation");
const rq = buildRecordsQuery("tamil-nadu", "exit", "imp1", { pin: "600 001" }) as Record<string, unknown>;
eq("pin filter normalised on query", rq.pinNormalized, "600001");
ok("no pin constraint when filter empty", !("pinNormalized" in (buildRecordsQuery("tamil-nadu", "exit", "imp1", {}) as Record<string, unknown>)));

/* ---- 9. assumed-PIN allocation -------------------------------------- */
console.log("\n9. Assumed-PIN allocation (even, deterministic, within party)");
const mk = (responseId: string, pin: string, recordedDistrict: string, estimatedDistrict: string, scenarioDistrict: string, party: string, status = "valid"): AllocInput =>
  ({ responseId, pin, recordedDistrict, estimatedDistrict, scenarioDistrict, party, status });
const allocRows: AllocInput[] = [
  mk("E-01", "600001", "Chennai", "", "Chennai", "TVK"),
  mk("E-02", "", "Madurai", "", "Madurai", "TVK"),
  mk("E-03", "", "Madurai", "", "Madurai", "TVK"),
  mk("E-04", "", "Madurai", "", "Madurai", "DMK+INC+VCK"),
  mk("E-05", "", "", "Kallakurichi", "Kallakurichi", "TVK"),
  mk("E-06", "", "", "", "", "TVK"),
  mk("E-07", "999999", "Salem", "", "Salem", "NTK"),
];
const recs = allocatePinAssignments(allocRows, { includeEstimated: true });
eq("recorded PIN confirmed → reference-derived", recs[0].basis, "reference-derived");
eq("recorded PIN preserved", recs[0].assumedPin, "600001");
eq("district-only → district-based assumption", recs[1].basisLabel, PIN_BASIS_LABEL["district-assumption"]);
ok("assigned PIN is a Madurai candidate", candidatePinsForDistrict("Madurai").includes(recs[1].assumedPin));
ok("even split across candidates (2 TVK records → 2 distinct PINs)", recs[1].assumedPin !== recs[2].assumedPin);
eq("estimated district basis label", recs[4].basisLabel, PIN_BASIS_LABEL["estimated-district-assumption"]);
eq("estimated district basis flag", recs[4].districtBasis, "estimated");
ok("estimated assigned PIN is a Kallakurichi candidate", candidatePinsForDistrict("Kallakurichi").includes(recs[4].assumedPin));
eq("no usable district → unassigned", recs[5].basis, "unassigned");
eq("unassigned PIN empty", recs[5].assumedPin, "");
eq("unconfirmed supplied PIN kept as recorded", recs[6].basis, "recorded");
eq("recorded PIN preserved (unconfirmed)", recs[6].assumedPin, "999999");
eq("allocation version stamped", recs[0].allocationVersion, PIN_ALLOCATION_VERSION);

const recsAgain = allocatePinAssignments(allocRows, { includeEstimated: true });
eq("re-run identical", JSON.stringify(recsAgain), JSON.stringify(recs));

const noEst = allocatePinAssignments(allocRows, { includeEstimated: false });
eq("exclude estimated → estimated-only record unassigned", noEst[4].basis, "unassigned");

const sum = summarizeAllocation(recs);
eq("summary total", sum.total, 7);
eq("summary valid", sum.valid, 7);
eq("summary recordedPin", sum.recordedPin, 2);
eq("summary eligible", sum.eligible, 5);
eq("summary assigned", sum.assigned, 4);
eq("summary unresolved", sum.unresolved, 1);
ok("assigned + unresolved = eligible", sum.reconcile.ok && sum.reconcile.assignedPlusUnresolved === sum.eligible);
ok("party totals reconcile", sum.reconcile.partyOk);
eq("reference version surfaced", sum.reference.version, POSTAL_REFERENCE.version);
ok("byDistrict includes per-PIN totals", sum.byDistrict.some((d) => d.district === "Madurai" && d.byPin.length > 0));

/* ---- 10. preview → commit → filter → aggregate → export harness ----- */
console.log("\n10. E2E harness (test case study pin-audit-test)");
const TEST_CASE = "pin-audit-test";
// A larger synthetic district dataset (3 districts, several parties).
const e2eRows: AllocInput[] = [];
const parties = ["TVK", "DMK+INC+VCK", "AIADMK+BJP+PMK+AMMK", "NTK"];
let n = 0;
for (const district of ["Madurai", "Salem", "Erode"]) {
  for (const party of parties) {
    for (let i = 0; i < 25; i++) {
      n++;
      // Every 10th record keeps a real recorded PIN; the rest are district-only.
      const withPin = i % 10 === 0;
      e2eRows.push({
        responseId: `${district}-${party}-${String(i).padStart(3, "0")}`,
        pin: withPin ? candidatePinsForDistrict(district)[0] : "",
        recordedDistrict: district, estimatedDistrict: "", scenarioDistrict: district,
        party, status: "valid",
      });
    }
  }
}
e2eRows.push({ responseId: "UNRES-1", pin: "", recordedDistrict: "", estimatedDistrict: "", scenarioDistrict: "", party: "TVK", status: "valid" });
e2eRows.push({ responseId: "UNRES-2", pin: "", recordedDistrict: "Nowhere", estimatedDistrict: "", scenarioDistrict: "Nowhere", party: "NTK", status: "valid" });

const snapshot = e2eRows.map((r) => JSON.stringify({ responseId: r.responseId, pin: r.pin, recordedDistrict: r.recordedDistrict, party: r.party }));
const committed = allocatePinAssignments(e2eRows, { includeEstimated: true });
const e2eSummary = summarizeAllocation(committed);
const byId = new Map(committed.map((r) => [r.responseId, r]));

// (a) every assigned PIN belongs to the eligible district reference
const assigned = committed.filter((r) => r.basis === "district-assumption" || r.basis === "estimated-district-assumption");
ok("every assigned PIN ∈ its district reference", assigned.every((r) => candidatePinsForDistrict(r.district).includes(r.assumedPin)));
// (b) recorded-PIN records are not re-assigned
const recordedRecs = committed.filter((r) => r.basis === "recorded" || r.basis === "reference-derived");
ok("recorded records keep their original PIN", recordedRecs.every((r, i) => r.assumedPin === e2eRows[committed.indexOf(r)].pin), String(recordedRecs.length));
// (c) originals unchanged (party, pin, district, responseId)
const post = e2eRows.map((r) => JSON.stringify({ responseId: r.responseId, pin: r.pin, recordedDistrict: r.recordedDistrict, party: r.party }));
ok("original PINs/districts/parties/IDs unchanged", JSON.stringify(post) === JSON.stringify(snapshot));
// (d) reconcile
ok("assigned + unresolved reconcile with eligible", e2eSummary.reconcile.ok && e2eSummary.assigned + e2eSummary.unresolved === e2eSummary.eligible);
// (e) party totals reconcile statewide and per district
const statewideParty = e2eSummary.byParty;
const districtPartySum: Record<string, number> = {};
for (const d of e2eSummary.byDistrict) for (const [p, c] of Object.entries(d.byParty)) districtPartySum[p] = (districtPartySum[p] ?? 0) + c;
eq("party totals reconcile across districts", districtPartySum, statewideParty);
ok("re-run identical", JSON.stringify(allocatePinAssignments(e2eRows, { includeEstimated: true })) === JSON.stringify(committed));
// (f) no assumed data marked as recorded
ok("assigned records are not labelled recorded", assigned.every((r) => r.basis !== "recorded" && r.basis !== "reference-derived"));
// (g) unresolved districts reported
ok("district without reference candidates is unresolved", e2eSummary.districtsWithoutCandidates.includes("Nowhere"));

// filtering: build a PIN → records index from the committed data
const pinIndex = new Map<string, number>();
for (const r of committed) if (r.assumedPin) pinIndex.set(r.assumedPin, (pinIndex.get(r.assumedPin) ?? 0) + 1);
const summaryPinTotal = e2eSummary.byDistrict.reduce((a, d) => a + d.byPin.reduce((x, p) => x + p.total, 0), 0);
eq("filter index total = summary PIN total", [...pinIndex.values()].reduce((a, b) => a + b, 0), summaryPinTotal);

// export: build the two-sheet workbook with the scenario fields embedded, then re-parse
const exportRows: Row[] = e2eRows.map((r) => {
  const a = byId.get(r.responseId)!;
  return {
    "Response ID": r.responseId, "Party": r.party, "District": r.recordedDistrict, "PIN Code": r.pin,
    "Assumed PIN Code": a.assumedPin, "PIN Geography Basis": a.basisLabel,
    "PIN Mapping Source": a.source, "PIN Assignment Method": a.method,
    "PIN Allocation Version": a.allocationVersion, "PIN District Basis": a.districtBasis,
  };
});
// Real export route calls buildWorkbook(opinion, exit) with no header override.
const e2eBuf = buildWorkbook([], exportRows);
const e2eWb = XLSX.read(e2eBuf, { type: "buffer" });
const exitOut = XLSX.utils.sheet_to_json<Row>(e2eWb.Sheets["Exit Poll"], { defval: "", raw: true });
ok("export keeps both sheets", !!e2eWb.Sheets["Exit Poll"] && !!e2eWb.Sheets["Opinion Poll"]);
ok("export includes assumed fields", exitOut.every((r) => "Assumed PIN Code" in r && "PIN Allocation Version" in r));
eq("export preserves original PIN for recorded row", exitOut[0]["PIN Code"], candidatePinsForDistrict("Madurai")[0]);
eq("export assumed PIN matches allocation", exitOut[0]["Assumed PIN Code"], byId.get(String(exitOut[0]["Response ID"]))!.assumedPin);
eq("exported allocation version", exitOut[0]["PIN Allocation Version"], PIN_ALLOCATION_VERSION);
ok("opinion sheet stays empty until real data", XLSX.utils.sheet_to_json(e2eWb.Sheets["Opinion Poll"], { defval: "", raw: true }).length === 0);

console.log(`\n${fail === 0 ? "ALL PASSED" : "FAILURES"}: ${pass} passed, ${fail} failed (case study: ${TEST_CASE})`);
if (fail > 0) process.exitCode = 1;
