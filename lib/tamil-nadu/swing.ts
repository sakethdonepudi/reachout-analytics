/** One formatter for swing cells, including negative zero and rounded zero. */
export function swingLabel(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) < 0.05) return "(0.0pp)";
  return `(${value > 0 ? "+" : ""}${value.toFixed(1)}pp)`;
}

export function swingTone(value: number): "up" | "down" | "flat" {
  if (!Number.isFinite(value) || Math.abs(value) < 0.05) return "flat";
  return value > 0 ? "up" : "down";
}
