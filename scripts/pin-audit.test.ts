/* =====================================================================
   PIN pipeline audit — import → canonicalisation → validation → storage
   mapping → aggregation assembly → export.

   Run: npx tsx scripts/pin-audit.test.ts
   Uses a synthetic dataset with KNOWN PIN values. It never touches
   MongoDB and never writes to the published survey.
   ===================================================================== */

import * as XLSX from "xlsx";
import { parseWorkbook, validateSheet, buildWorkbook, type Row } from "@/lib/poll-data";
import { toDoc, assemblePinAggregates, buildRecordsQuery, type PinGroupRow } from "@/lib/poll-store";
import { normalizePin, classifyPin, resolveRowPin } from "@/lib/pin";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
function eq(name: string, got: unknown, want: unknown) {
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}

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
ok("canonical sheet keeps PIN Code", parsed.sheets.exit.every((r) => "PIN Code" in r));
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
eq("pinLocationKnown (in representative reference)", ev.pinLocationKnown, 4);
eq("pinLocationUnknown (not in reference, still format-valid)", ev.pinLocationUnknown, 1);
eq("pinMismatch (PIN ref district ≠ stated district)", ev.pinMismatch, 1);
ok("invalid-format produces a warning issue", ev.issues.some((i) => i.field === "PIN Code" && i.severity === "warning"));

/* ---- 4. conflicting columns ---------------------------------------- */
console.log("\n4. Conflicting PIN columns are detected, not overwritten");
const conflictWb = workbook(
  [],
  ["Response ID", "Party", "PIN Code"],
  [
    ["C1", "TVK", "600001", "600002"],
    ["C2", "TVK", "600001", ""],
  ],
  ["Response ID", "Party", "PIN Code", "Pincode"],
);
const cparsed = parseWorkbook(conflictWb);
const conflictErrors = cparsed.errors.filter((e) => e.field === "PIN Code" && e.severity === "error");
ok("conflict reported as an error", conflictErrors.length >= 1, JSON.stringify(cparsed.errors));
const cRow = cparsed.sheets.exit[0] as Row;
ok("row left untouched on conflict (both columns intact)", cRow["PIN Code"] === "600001" && cRow["Pincode"] === "600002");
eq("conflict row resolves as conflict", resolveRowPin(cRow).conflict, true);
const cval = validateSheet("Exit Poll", cparsed.sheets.exit);
eq("validateSheet pinConflicts", cval.pinConflicts, 1);

/* ---- 5. storage mapping --------------------------------------------- */
console.log("\n5. Storage mapping (Mongo document fields)");
const doc = toDoc(parsed.sheets.exit[2] as Row, "tamil-nadu", "exit", "imp1");
eq("stored pin preserved as text", doc.pin, "060001");
eq("stored pinNormalized", doc.pinNormalized, "060001");
eq("stored pinFormat", doc.pinFormat, "ok");
eq("stored pinLocationKnown false when unknown", doc.pinLocationKnown, false);
const docKnown = toDoc(parsed.sheets.exit[0] as Row, "tamil-nadu", "exit", "imp1");
eq("stored pinRefDistrict for known PIN", docKnown.pinRefDistrict, "Chennai");
const docBlank = toDoc(parsed.sheets.exit[5] as Row, "tamil-nadu", "exit", "imp1");
eq("blank pin stored empty", docBlank.pin, "");
eq("blank pin format", docBlank.pinFormat, "blank");

/* ---- 6. export preserves supplied PINs ------------------------------ */
console.log("\n6. Excel export preserves supplied PIN codes");
const outBuf = buildWorkbook([], parsed.sheets.exit as Row[], exitHeaders);
const reparsed = XLSX.read(outBuf, { type: "buffer" });
const outRows = XLSX.utils.sheet_to_json<Row>(reparsed.Sheets["Exit Poll"], { defval: "", raw: true });
eq("exported leading-zero PIN preserved", outRows[2]["PIN Code"], "060001");
eq("exported numeric PIN as text", outRows[1]["PIN Code"], "600002");
eq("exported blank stays blank", outRows[5]["PIN Code"], "");
ok("no random/representative PIN substituted for a blank row", String(outRows[5]["PIN Code"]) === "");
ok("all exported PIN values are strings", outRows.every((r) => typeof r["PIN Code"] === "string"));

/* ---- 7. aggregation assembly ---------------------------------------- */
console.log("\n7. PIN aggregation assembly (scoping + counts + no-PIN retained)");
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
eq("withoutPin (blank PIN retained in totals)", agg.withoutPin, 10);
eq("invalidPinResponses", agg.invalidPinResponses, 2);
eq("usable PIN buckets", agg.pins.length, 2);
eq("top PIN first (by valid)", agg.pins[0].pin, "600001");
eq("top PIN valid", agg.pins[0].valid, 4);
eq("second PIN valid=0 still listed", agg.pins[1].pin, "625001");
ok("no bucket fabricated for invalid 5-digit PIN", !agg.pins.some((p) => p.pin === "12345"));

/* ---- 8. records filter (admin) -------------------------------------- */
console.log("\n8. Records filter — PIN filter normalisation");
const rq = buildRecordsQuery("tamil-nadu", "exit", "imp1", { pin: "600 001", status: "valid" }) as Record<string, unknown>;
eq("pin filter normalised on query", rq.pinNormalized, "600001");
eq("status filter passed through", rq.status, "valid");
const rqEmpty = buildRecordsQuery("tamil-nadu", "exit", "imp1", {}) as Record<string, unknown>;
ok("no pin constraint when filter empty", !("pinNormalized" in rqEmpty));

console.log(`\n${fail === 0 ? "ALL PASSED" : "FAILURES"}: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
