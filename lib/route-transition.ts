/**
 * Small navigation-transition bus. Any client component that wants a
 * cinematic transition into a route calls `startRouteTransition(href, meta)`;
 * the single <RouteTransition /> mounted in the root layout picks it up,
 * covers the screen, pushes the route, then reveals the new page.
 *
 * Navigation still falls back to nothing harmful if the event has no
 * listener — callers should call router.push as well when appropriate.
 */
export type TransitionMeta = {
  /** big line, e.g. the case title */
  title: string;
  /** small saffron eyebrow, e.g. "Tamil Nadu" */
  eyebrow?: string;
  /** muted line under the title, e.g. the party · leader */
  subtitle?: string;
};

export const TRANSITION_EVENT = "reachout:navigate";

export type TransitionDetail = { href: string; meta: TransitionMeta };

export function startRouteTransition(href: string, meta: TransitionMeta) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TransitionDetail>(TRANSITION_EVENT, { detail: { href, meta } }));
}
