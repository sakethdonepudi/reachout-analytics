/** Pure Meta sync helpers, safe to test without MongoDB or the Graph API. */

export const META_CONNECTION_TTL_MS = 60 * 24 * 60 * 60 * 1000;
export const META_GRAPH_VERSION = "v27.0";
export const META_RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

/** Convert a Graph monetary string/number in major units to integer paise. */
export function toPaise(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 100);
}

/** Ad-account balance fields already arrive in the account's minor unit. */
export function minorToPaise(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

export function formatInr(paise: number | null | undefined): string {
  if (paise == null || !Number.isFinite(paise)) return "—";
  const rupees = paise / 100;
  if (Math.abs(rupees) >= 1e7) return `₹${(rupees / 1e7).toFixed(2)}Cr`;
  if (Math.abs(rupees) >= 1e5) return `₹${(rupees / 1e5).toFixed(2)}L`;
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(rupees)}`;
}

export function connectionExpiresAt(connectedAt: string): string {
  return new Date(new Date(connectedAt).getTime() + META_CONNECTION_TTL_MS).toISOString();
}

export function isConnectionExpired(expiresAt: string | null | undefined, now = Date.now()): boolean {
  if (!expiresAt) return false;
  const timestamp = new Date(expiresAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= now;
}

export function expiresWithinHour(expiresAt: string | null | undefined, now = Date.now()): boolean {
  if (!expiresAt) return false;
  const timestamp = new Date(expiresAt).getTime();
  return Number.isFinite(timestamp) && timestamp > now && timestamp - now <= 60 * 60 * 1000;
}

/**
 * Range reach is never additive. It must come from the all_days range row.
 * Daily reach values are accepted only so callers can be explicit about not
 * summing them; this function never consumes them.
 */
export function rangeReach(range: { reach?: number | null } | null, _daily: Array<{ reach?: number | null }> = []): number | null {
  return range?.reach ?? null;
}

export function retryDelayMs(input: { retryAfter?: string | null; usage?: string | null } | null, attempt: number, now = Date.now()): number {
  const retryAfter = Number(input?.retryAfter ?? "");
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.ceil(retryAfter * 1000);
  if (input?.usage) {
    try {
      const parsed = JSON.parse(input.usage) as Record<string, Array<{ call_count?: number; total_cputime?: number; total_time?: number }>>;
      const values = Object.values(parsed).flat();
      const highest = Math.max(0, ...values.flatMap((value) => [value.call_count ?? 0, value.total_cputime ?? 0, value.total_time ?? 0]));
      if (highest >= 90) return Math.min(15 * 60 * 1000, 1000 * 2 ** attempt);
    } catch {
      // fall through to the exponential delay
    }
  }
  return Math.min(15 * 60 * 1000, 1000 * 2 ** Math.max(0, attempt));
}

export function isRateLimited(code: number | null | undefined): boolean {
  return code != null && META_RATE_LIMIT_CODES.has(code);
}
