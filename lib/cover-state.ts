/* Tracks the route-transition cover so no second loader paints over it. */
let active = false;
const listeners = new Set<() => void>();

export function setCoverActive(value: boolean) {
  active = value;
  if (!value) for (const listener of [...listeners]) listener();
}

export function isCoverActive(): boolean {
  return active;
}

export function onCoverEnd(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
