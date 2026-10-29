import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

export type MapTheme = "light" | "dark";

/** Shared visual hierarchy for both state maps. */
export const MAP_STYLE = {
  label: {
    district: { size: 14, mobile: 13, weight: 600 },
    assembly: { size: 12, mobile: 11, weight: 500 },
    selectedAssembly: { size: 13, mobile: 12, weight: 600 },
    halo: { light: "rgba(255,255,255,.92)", dark: "rgba(6,10,18,.86)" },
    backing: { light: "rgba(255,255,255,.52)", dark: "rgba(12,18,27,.5)" },
  },
  border: { state: 1.7, district: 1.1, assembly: 0.72, selected: 2.0 },
  gradient: { edge: 0.13, axisX: 0.86, axisZ: 0.5 },
  lighting: { hemisphere: 0.95, key: 1.02, fill: 0.34 },
  surface: { roughness: 0.9, metalness: 0.02, sideDarken: 0.78, selectedEmissive: 0.2, hoverEmissive: 0.08 },
} as const;

export type TopTwo<T extends string> = {
  first: T | null;
  second: T | null;
  firstShare: number;
  secondShare: number;
  /** Normalised relative proportions, summing to 1. */
  p1: number;
  p2: number;
  marginPp: number | null;
};

export function topTwo<T extends string>(shares: Partial<Record<T, number>> | null | undefined, order: readonly T[]): TopTwo<T> {
  const ranked = order
    .map((party) => ({ party, value: Math.max(0, shares?.[party] ?? 0) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
  if (!ranked.length) return { first: null, second: null, firstShare: 0, secondShare: 0, p1: 0, p2: 0, marginPp: null };
  const first = ranked[0], second = ranked[1] ?? null;
  const total = first.value + (second?.value ?? 0) || 1;
  return {
    first: first.party, second: second?.party ?? null,
    firstShare: first.value, secondShare: second?.value ?? 0,
    p1: first.value / total, p2: (second?.value ?? 0) / total,
    marginPp: second ? Math.max(0, (first.value - second.value) * 100) : 100,
  };
}

/** Narrow smooth transition so both parties remain recognisable. */
export function gradientColor(first: string, second: string, p1: number, t: number): THREE.Color {
  if (!first) return new THREE.Color("#9aa1ab");
  const center = Math.max(0.12, Math.min(0.88, p1));
  const edge = MAP_STYLE.gradient.edge;
  const lo = Math.max(0, center - edge), hi = Math.min(1, center + edge);
  const u = Math.max(0, Math.min(1, (t - lo) / Math.max(0.0001, hi - lo)));
  const f = u * u * (3 - 2 * u);
  return new THREE.Color(first).lerp(new THREE.Color(second), f);
}

export function labelSize(kind: "district" | "assembly" | "selectedAssembly", mobile: boolean): { px: number; weight: number } {
  const token = MAP_STYLE.label[kind];
  return { px: mobile ? token.mobile : token.size, weight: token.weight };
}

export function addMapLights(scene: THREE.Scene) {
  const { hemisphere, key, fill } = MAP_STYLE.lighting;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x808898, hemisphere));
  const keyLight = new THREE.DirectionalLight(0xffffff, key);
  keyLight.position.set(-260, 620, 420);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xaebacc, fill);
  fillLight.position.set(420, 240, -520);
  scene.add(fillLight);
}

export type ScreenLine = { line: LineSegments2; material: LineMaterial };

/** Screen-space line widths (pixels) via LineMaterial, stable while zooming. */
export function createScreenLine(points: number[], color: string, width: number, resolution: THREE.Vector2, opacity = 1): ScreenLine {
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(points.length ? points : [0, 0, 0, 0, 0, 0]);
  const material = new LineMaterial({ color, linewidth: width, worldUnits: false, transparent: true, opacity, depthTest: false, depthWrite: false });
  material.resolution.copy(resolution);
  const line = new LineSegments2(geometry, material);
  line.frustumCulled = false;
  line.renderOrder = 20;
  return { line, material };
}

export function setScreenLinePoints(screenLine: ScreenLine, points: number[]) {
  screenLine.line.geometry.setPositions(points.length ? points : [0, 0, 0, 0, 0, 0]);
}

export function updateLineResolution(screenLine: ScreenLine, width: number, height: number) {
  screenLine.material.resolution.set(Math.max(1, width), Math.max(1, height));
}
