export type TargetGapRow = { key: string; value: number; n: number };

/**
 * The Post-poll rule: pick the rows furthest below the target party average.
 * A smaller gap never beats a larger one, even if it appears first in the data.
 */
export function selectGapRows(rows: TargetGapRow[], average: number, limit = 3): Set<string> {
  return new Set(
    rows
      .filter((row) => row.value < average)
      .map((row) => ({ ...row, gap: average - row.value }))
      .sort((left, right) => right.gap - left.gap || right.n - left.n || left.key.localeCompare(right.key))
      .slice(0, limit)
      .map((row) => row.key),
  );
}
