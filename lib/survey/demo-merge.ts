import type { SurveyDemo, SurveyDemoRow } from "./types";

/**
 * Keep every group from the reference period. A month may omit low-sample
 * groups; those rows return with zero answers so the table can show the
 * "n answers, too few to show" state instead of dropping the group.
 */
export function mergeDemoRows(demo: SurveyDemo | undefined, reference: SurveyDemo | undefined): SurveyDemo | undefined {
  if (!demo) return undefined;
  if (!reference?.rows.length) return demo;
  const width = demo.rows[0]?.v.length ?? reference.rows[0]?.v.length ?? 0;
  const zero = () => Array.from({ length: width }, () => 0);
  const byGroup = new Map(demo.rows.map((row) => [row.g, row]));
  const rows: SurveyDemoRow[] = reference.rows.map((row) => byGroup.get(row.g) ?? { g: row.g, n: 0, v: zero() });
  const referenceGroups = new Set(reference.rows.map((row) => row.g));
  for (const row of demo.rows) if (!referenceGroups.has(row.g)) rows.push(row);
  return { ...demo, rows };
}

/** Merge every profile in a period slot against the period-level reference. */
export function mergeProfiles(demo: Record<string, SurveyDemo> | undefined, reference: Record<string, SurveyDemo> | undefined): Record<string, SurveyDemo> {
  return Object.fromEntries(Object.entries(demo ?? {}).map(([key, item]) => [key, mergeDemoRows(item, reference?.[key]) ?? item]));
}
