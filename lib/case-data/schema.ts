import type { PollKind, PollSegment, ReasonNumber, SegmentScope, SegmentType, VoteShareReason } from "./types";

export const SEGMENT_HEADERS = ["State", "Poll Type", "Scope", "Scope Name", "Segment Type", "Segment Label", "Party", "Share (%)", "N", "As Of"] as const;
export const REASON_HEADERS = ["ID", "State", "Title", "Party", "Impact PP", "Segments", "Explanation", "Before", "After", "Related Campaigns", "Social URLs", "As Of"] as const;

const POLL_TYPES = new Set<PollKind>(["opinion", "exit"]);
const SCOPES = new Set<SegmentScope>(["statewide", "district", "assembly"]);
const SEGMENTS = new Set<SegmentType>(["gender", "age", "caste", "region"]);

const text = (value: unknown) => String(value ?? "").trim();
const num = (value: unknown) => {
  if (value === "" || value == null) return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[%,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};
const list = (value: unknown) => text(value).split(",").map((item) => item.trim()).filter(Boolean);

function parseReasonNumbers(value: unknown, line: number, label: string, errors: string[]): ReasonNumber[] {
  const raw = text(value);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return parsed.map((item) => {
      if (!item || typeof item !== "object") throw new Error("bad item");
      const row = item as Record<string, unknown>;
      const name = text(row.label ?? row.segment);
      const party = text(row.party);
      const share = num(row.share);
      if (!name || !party || share == null) throw new Error("missing label, party or share");
      return { label: name, party, share };
    });
  } catch {
    errors.push(`Row ${line}: ${label} must be a JSON array like [{"label":"Male","party":"AIADMK","share":35.4}]`);
    return [];
  }
}

export function validateSegments(rows: Record<string, unknown>[], targetState: string): { rows: PollSegment[]; errors: string[]; warnings: string[] } {
  const out: PollSegment[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  rows.forEach((row, index) => {
    const line = index + 2;
    const state = text(row["State"]) || targetState;
    const pollType = text(row["Poll Type"]).toLowerCase() as PollKind;
    const scope = (text(row["Scope"]) || "statewide").toLowerCase() as SegmentScope;
    const segmentType = text(row["Segment Type"]).toLowerCase() as SegmentType;
    const segmentLabel = text(row["Segment Label"]);
    const party = text(row["Party"]);
    const share = num(row["Share (%)"]);
    const n = num(row["N"]);
    const localErrors: string[] = [];
    if (!state) localErrors.push(`Row ${line}: State is required`);
    if (!POLL_TYPES.has(pollType)) localErrors.push(`Row ${line}: Poll Type must be opinion or exit`);
    if (!SCOPES.has(scope)) localErrors.push(`Row ${line}: Scope must be statewide, district or assembly`);
    if (!SEGMENTS.has(segmentType)) localErrors.push(`Row ${line}: Segment Type must be gender, age, caste or region`);
    if (!segmentLabel) localErrors.push(`Row ${line}: Segment Label is required`);
    if (!party) localErrors.push(`Row ${line}: Party is required`);
    if (share == null || share < 0 || share > 100) localErrors.push(`Row ${line}: Share (%) must be a number from 0 to 100`);
    if (n != null && n < 0) localErrors.push(`Row ${line}: N cannot be negative`);
    if (localErrors.length) { errors.push(...localErrors); return; }
    if (scope !== "statewide" && !text(row["Scope Name"])) warnings.push(`Row ${line}: Scope Name is empty for a ${scope} row`);
    out.push({ state, pollType, scope, scopeName: text(row["Scope Name"]) || null, segmentType, segmentLabel, party, share: share!, n, asOf: text(row["As Of"]) });
  });
  return { rows: out, errors, warnings };
}

export function validateReasons(rows: Record<string, unknown>[], targetState: string): { rows: VoteShareReason[]; errors: string[]; warnings: string[] } {
  const out: VoteShareReason[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const line = index + 2;
    const id = text(row["ID"]);
    const state = text(row["State"]) || targetState;
    const title = text(row["Title"]);
    const party = text(row["Party"]);
    const impactPp = num(row["Impact PP"]);
    const explanation = text(row["Explanation"]);
    const local: string[] = [];
    if (!id) local.push(`Row ${line}: ID is required`);
    if (id && seen.has(id)) local.push(`Row ${line}: duplicate ID ${id}`);
    if (!title) local.push(`Row ${line}: Title is required`);
    if (!party) local.push(`Row ${line}: Party is required`);
    if (impactPp == null) local.push(`Row ${line}: Impact PP must be a number`);
    if (!explanation) local.push(`Row ${line}: Explanation is required`);
    const before = parseReasonNumbers(row["Before"], line, "Before", local);
    const after = parseReasonNumbers(row["After"], line, "After", local);
    if (local.length) { errors.push(...local); return; }
    seen.add(id);
    if (!before.length && !after.length) warnings.push(`Row ${line}: no before/after numbers supplied`);
    out.push({
      id, state, title, party, impactPp: impactPp!, segments: list(row["Segments"]), explanation, before, after,
      relatedCampaigns: list(row["Related Campaigns"]), socialUrls: list(row["Social URLs"]), asOf: text(row["As Of"]),
    });
  });
  return { rows: out, errors, warnings };
}
