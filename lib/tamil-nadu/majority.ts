export type MajorityResult = {
  leader: string | null;
  seats: number;
  majority: number;
  status: "majority" | "hung";
  tie: boolean;
};

/**
 * A projected majority comes from the projected seats, never from the actual
 * result or the survey vote share. Ties and shortfalls are hung assemblies.
 */
export function projectedMajority(
  seats: Record<string, unknown>,
  parties: string[],
  majority = 118,
): MajorityResult {
  const ranked = parties
    .map((party) => ({ party, seats: Number(seats[party] ?? 0) }))
    .filter((row) => Number.isFinite(row.seats))
    .sort((a, b) => b.seats - a.seats);
  const top = ranked[0] ?? null;
  const second = ranked[1] ?? null;
  const tie = Boolean(top && second && top.seats === second.seats);
  const status = top && !tie && top.seats >= majority ? "majority" : "hung";
  return { leader: top?.party ?? null, seats: top?.seats ?? 0, majority, status, tie };
}
