/* =====================================================================
   Even district → PIN division.

   For a district with N valid party responses and K eligible reference PINs,
   divide the responses across the PINs:
     - each PIN gets floor(N / K) responses;
     - the integer remainder is distributed deterministically (one extra to the
       first (N mod K) PINs in reference order) so PIN totals equal N exactly;
     - each party's allocation is balanced across PINs while respecting those
       per-PIN capacities, using a single deterministic integer allocation
       (largest-remainder), so total counts never become uneven.

   This is a scenario allocation, not recovered respondent geography: it is
   stored/displayed separately from recorded PINs. Pure and deterministic —
   same input yields identical output.
   ===================================================================== */

/** Method + version stamped into exports (provenance). */
export const PIN_DIVISION_METHOD = "even-district-division";
export const PIN_DIVISION_VERSION = "v1";

export type PartyCounts = Record<string, number>;
export type PinDivision = { pin: string; valid: number; parties: PartyCounts; capacity: number };

/**
 * @param totalValid  N — the district's valid party responses (sum of parties).
 * @param parties     party → valid count for the district.
 * @param pins        K eligible reference PINs, in canonical order.
 */
export function divideDistrictAcrossPins(totalValid: number, parties: PartyCounts, pins: string[]): PinDivision[] {
  const K = pins.length;
  if (K === 0) return [];
  if (totalValid <= 0) return pins.map((pin) => ({ pin, valid: 0, parties: {}, capacity: 0 }));

  const base = Math.floor(totalValid / K);
  const rem = totalValid % K;
  const capacity = pins.map((_, i) => base + (i < rem ? 1 : 0));
  const remaining = [...capacity];
  const out: PartyCounts[] = pins.map(() => ({}));

  // Deterministic party order (stable across runs).
  const partyKeys = Object.keys(parties).sort();
  for (const party of partyKeys) {
    let c = Math.max(0, Math.floor(parties[party] ?? 0));
    const totalRemaining = remaining.reduce((a, b) => a + b, 0);
    if (c > totalRemaining) c = totalRemaining;
    if (c === 0) continue;

    // Largest-remainder apportionment over remaining capacity.
    const raw = remaining.map((r) => (totalRemaining > 0 ? (c * r) / totalRemaining : 0));
    const floors = raw.map((x) => Math.floor(x));
    let assigned = floors.reduce((a, b) => a + b, 0);
    const order = raw
      .map((x, i) => ({ i, frac: x - Math.floor(x) }))
      .sort((a, b) => b.frac - a.frac || a.i - b.i);
    for (let k = 0; assigned < c && k < order.length; k++, assigned++) floors[order[k].i] += 1;

    floors.forEach((n, i) => {
      if (n) {
        out[i][party] = (out[i][party] ?? 0) + n;
        remaining[i] -= n;
      }
    });
  }

  return pins.map((pin, i) => ({
    pin,
    capacity: capacity[i],
    valid: Object.values(out[i]).reduce((a, b) => a + b, 0),
    parties: out[i],
  }));
}

/** Party shares (%) for one PIN's division, using its assigned valid responses. */
export function pinShares(div: PinDivision): { party: string; count: number; pct: number }[] {
  const denom = div.valid || 0;
  return Object.entries(div.parties)
    .map(([party, count]) => ({ party, count, pct: denom ? +((count / denom) * 100).toFixed(2) : 0 }))
    .sort((a, b) => b.count - a.count);
}

/** Reconciliation helper: exact per-PIN totals and party totals. */
export function reconcileDivision(divs: PinDivision[], parties: PartyCounts) {
  const pinTotal = divs.reduce((a, d) => a + d.valid, 0);
  const partyTotals: PartyCounts = {};
  for (const d of divs) for (const [p, n] of Object.entries(d.parties)) partyTotals[p] = (partyTotals[p] ?? 0) + n;
  const partyOk = Object.keys(parties).every((p) => (partyTotals[p] ?? 0) === (parties[p] ?? 0));
  return { pinTotal, expected: Object.values(parties).reduce((a, b) => a + b, 0), partyTotals, partyOk };
}
