/** Shared motion tokens. Keep CSS and JS on the same values. */

export const DUR = {
  instant: 80,
  fast: 140,
  base: 200,
  slow: 280,
  hero: 600,
} as const;

export const EASE = {
  out: "cubic-bezier(.2,.8,.2,1)",
  in: "cubic-bezier(.4,0,1,1)",
  inOut: "cubic-bezier(.65,0,.35,1)",
} as const;

/** One spring for squash, stretch and settle. */
export const SPRING = { stiffness: 420, damping: 32 } as const;

export type MotionTier = "a" | "b" | "c";

/** A: marketing, B: case studies, C: dashboard, users and account. */
export function tierForPath(pathname: string): MotionTier {
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/account")) return "c";
  if (pathname.startsWith("/case-studies") || pathname.startsWith("/campaigns")) return "b";
  return "a";
}
