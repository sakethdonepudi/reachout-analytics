/** One horizontal shake, skipped entirely under reduced motion. */
export function shakeElement(element: HTMLElement | null) {
  if (!element) return;
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  element.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-6px)" },
      { transform: "translateX(6px)" },
      { transform: "translateX(-3px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 300, easing: "ease-in-out" },
  );
}
