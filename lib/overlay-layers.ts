/* Shared layering, inert and scroll-lock state for overlays. */
const dialogStack: symbol[] = [];
const listeners = new Set<() => void>();
let scrollLocks = 0;
let previousOverflow = "";

function syncAnalysisInert() {
  if (typeof document === "undefined") return;
  document.querySelectorAll<HTMLElement>("[data-analysis-shell]").forEach((element) => {
    if (dialogStack.length > 0) element.setAttribute("inert", "");
    else element.removeAttribute("inert");
  });
}

export function acquireDialogLayer(id: symbol): number {
  const level = dialogStack.length;
  dialogStack.push(id);
  syncAnalysisInert();
  listeners.forEach((listener) => listener());
  return level;
}

export function releaseDialogLayer(id: symbol): void {
  const index = dialogStack.lastIndexOf(id);
  if (index >= 0) dialogStack.splice(index, 1);
  syncAnalysisInert();
  listeners.forEach((listener) => listener());
}

export function isTopDialogLayer(id: symbol): boolean {
  return dialogStack[dialogStack.length - 1] === id;
}

export function getDialogCount(): number {
  return dialogStack.length;
}

export function subscribeDialogCount(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function lockDocumentScroll(): void {
  if (typeof document === "undefined") return;
  if (scrollLocks === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLocks += 1;
}

export function unlockDocumentScroll(): void {
  if (typeof document === "undefined") return;
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.body.style.overflow = previousOverflow;
}
