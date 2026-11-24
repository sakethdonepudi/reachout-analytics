"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { X } from "lucide-react";
import { geoIdentity } from "d3-geo";
import { MAP_STYLE, addMapLights, createScreenLine, setScreenLinePoints, updateLineResolution, gradientColor, labelSize } from "@/lib/map-style";
import type { TnAc, TnDistrict, TnYearOrCurrent } from "@/lib/tamil-nadu/model";
import { PartyBadge } from "@/components/case-studies/tamil-nadu/party-badge";

export type MapTheme = "light" | "dark";
export type TnMapHover = {
  title: string;
  leader: string | null;
  rows: Array<{ party: string; value: number }>;
};

const BOX = 1000;
const DEPTH = 10;
const AC_DEPTH = 3;
const AC_LIFT = 1.6;
const SELECTED_LIFT = 3.6;
const BOUNDARY_Y = DEPTH + AC_DEPTH + 0.16;
const ANIM_MS = 340;
const CX = BOX / 2;
const CZ = BOX / 2;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type AcFeature = { type: "Feature"; properties: { no: number; name: string; district: string; centroid?: [number, number] }; geometry: { type: string; coordinates: unknown } };
type DistrictFeature = { type: "Feature"; properties: { district: string; centroid?: [number, number] }; geometry: { type: string; coordinates: unknown } };
type FC = { type: "FeatureCollection"; features: AcFeature[] };
type DFC = { type: "FeatureCollection"; features: DistrictFeature[] };
export type SurveyMapProps = {
  acs: TnAc[];
  districts: TnDistrict[];
  acGeo: { type: string; features: AcFeature[] };
  districtGeo: { type: string; features: DistrictFeature[] };
  partyOrder: readonly string[];
  partyColors: Record<string, string>;
  partyColorsDark: Record<string, string>;
  noDataColor: string;
  labelOffset: Record<string, { x: number; y: number }>;
  mobileLabelOffset: Record<string, { x: number; y: number }>;
  districtAlias: Record<string, string>;
  fillMode?: "gradient" | "flat";
  mobileLabelCount?: number;
  mobileForcedLabels?: string[];
  avoidDistrictCollisions?: boolean;
  stateTilt?: number;
  stateFit?: number;
  stateCenterZ?: number;
  mapRotation?: number;
  district: string | null;
  acNo: number | null;
  year: TnYearOrCurrent;
  theme: MapTheme;
  /** The single hover card, shared by districts and assembly constituencies. */
  tooltip?: (payload: { kind: "district" | "ac"; name: string; no?: number; district?: string }) => TnMapHover | null;
  /** Increment after a split resize to refit without changing selection. */
  fitKey?: number;
  onSelectDistrict: (name: string) => void;
  onSelectAc: (no: number) => void;
  onReset: () => void;
};

type Props = SurveyMapProps;
const PAL = {
  light: {
    none: "#e7ebef", side: "#d3d9e0", line: "rgba(40,58,78,.50)", hover: "#1d4ed8",
    sel: "#111827", label: "#1b2430", halo: "rgba(255,255,255,.94)", bg: "rgba(255,255,255,.98)", border: "rgba(20,24,31,.14)",
  },
  dark: {
    none: "#232322", side: "#181817", line: "rgba(210,210,200,.38)", hover: "#8fb0ff",
    sel: "#f0efec", label: "#f0efec", halo: "rgba(18,18,17,.92)", bg: "rgba(26,26,25,.98)", border: "rgba(210,210,200,.22)",
  },
};
let ACTIVE_PARTY_COLORS: Record<string, string> = {};
let ACTIVE_PARTY_ORDER: readonly string[] = [];
let ACTIVE_NO_DATA = "#94A3B8";
let ACTIVE_FILL_MODE: "gradient" | "flat" = "gradient";
const shade = (hex: string, amount: number) => {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(0.22, Math.min(0.68, hsl.l + amount)));
};
function shapeFor(feature: AcFeature | DistrictFeature, project: (p: [number, number]) => [number, number]): THREE.Shape[] {
  const coords = (feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates) as number[][][][];
  const shapes: THREE.Shape[] = [];
  for (const poly of coords) {
    if (!poly?.[0]?.length) continue;
    const outer = poly[0].map(([lng, lat]) => {
      const p = project([lng, lat]);
      return new THREE.Vector2(p[0] - CX, p[1] - CZ);
    });
    if (outer.length < 3) continue;
    const sh = new THREE.Shape(outer);
    for (let h = 1; h < poly.length; h++) {
      const hole = poly[h].map(([lng, lat]) => {
        const p = project([lng, lat]);
        return new THREE.Vector2(p[0] - CX, p[1] - CZ);
      });
      if (hole.length >= 3) sh.holes.push(new THREE.Path(hole));
    }
    shapes.push(sh);
  }
  return shapes;
}
type BlendInfo = {
  first: string | null; second: string | null;
  firstShare: number | null; secondShare: number | null;
  p1: number; p2: number; marginPp: number | null;
  color1: string; color2: string; color: string; label: string;
};
function blendFromShares(shares: Record<string, number> | null | undefined, label: string): BlendInfo {
  const ranked = ACTIVE_PARTY_ORDER
    .map((g) => ({ g, v: Math.max(0, shares?.[g] ?? 0) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);
  if (!ranked.length) return { first: null, second: null, firstShare: null, secondShare: null, p1: 0, p2: 0, marginPp: null, color1: ACTIVE_NO_DATA, color2: ACTIVE_NO_DATA, color: ACTIVE_NO_DATA, label: "No data" };
  const first = ranked[0]; const second = ranked[1] ?? null;
  const total = first.v + (second?.v ?? 0) || 1;
  const p1 = first.v / total; const p2 = second ? second.v / total : 0;
  return {
    first: first.g, second: second?.g ?? null,
    firstShare: first.v, secondShare: second?.v ?? null,
    p1, p2, marginPp: second ? Math.max(0, (first.v - second.v) * 100) : 100,
    color1: ACTIVE_PARTY_COLORS[first.g], color2: second ? ACTIVE_PARTY_COLORS[second.g] : ACTIVE_PARTY_COLORS[first.g],
    color: ACTIVE_PARTY_COLORS[first.g], label,
  };
}
function blendForAc(a: TnAc | undefined, year: TnYearOrCurrent): BlendInfo {
  if (!a) return blendFromShares(null, "No data");
  if (year === "2026") return blendFromShares(a.survey.shares as Record<string, number> | null, "2026 estimate");
  const rec = a.historical[year];
  return blendFromShares(rec.shares, `${year} result`);
}
function blendForDistrict(d: TnDistrict | undefined, year: TnYearOrCurrent): BlendInfo {
  if (!d) return blendFromShares(null, "No data");
  if (year === "2026") return blendFromShares(d.survey.shares as Record<string, number> | null, "2026 estimate");
  return blendFromShares(d.historical[year].shares, `${year} result`);
}
function blendColor(blend: BlendInfo, t: number): THREE.Color {
  if (!blend.first) return new THREE.Color(ACTIVE_NO_DATA);
  if (ACTIVE_FILL_MODE === "flat") {
    const margin = Math.max(0, Math.min(100, blend.marginPp ?? 0));
    return shade(ACTIVE_PARTY_COLORS[blend.first] ?? blend.color1, 0.1 - (margin / 100) * 0.26);
  }
  if (!blend.second) return new THREE.Color(blend.color1);
  return gradientColor(blend.color1, blend.color2, blend.p1, t);
}

export default function SurveyMap({ acs, districts, acGeo, districtGeo, partyOrder, partyColors, partyColorsDark, noDataColor, labelOffset, mobileLabelOffset, districtAlias, fillMode = "gradient", mobileLabelCount = 10, mobileForcedLabels = [], avoidDistrictCollisions = false, stateTilt = 0.82, stateFit = 1, stateCenterZ = 0, mapRotation = 0, district, acNo, year, theme, tooltip, fitKey = 0, onSelectDistrict, onSelectAc, onReset }: Props) {
  const AC_FC = acGeo as unknown as FC;
  const D_FC = districtGeo as unknown as DFC;
  const canonicalDistrict = (name: string) => districtAlias[name] ?? name;
  ACTIVE_PARTY_ORDER = partyOrder;
  ACTIVE_NO_DATA = noDataColor;
  ACTIVE_FILL_MODE = fillMode;
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; card: TnMapHover } | null>(null);
  const [touch, setTouch] = useState(false);
  const touchRef = useRef(false);
  const [sheet, setSheet] = useState<{ card: TnMapHover; kind: "district" | "ac"; name: string; no?: number; district?: string } | null>(null);
  const live = useRef({ acs, districts, district, acNo, year, theme, tooltip, onSelectDistrict, onSelectAc, onReset });
  live.current = { acs, districts, district, acNo, year, theme, tooltip, onSelectDistrict, onSelectAc, onReset };
  const acByNo = useMemo(() => new Map(acs.map((a) => [a.no, a])), [acs]);
  const acRef = useRef(acByNo); acRef.current = acByNo;
  const districtByName = useMemo(() => new Map(districts.map((d) => [d.name, d])), [districts]);
  const districtRef = useRef(districtByName); districtRef.current = districtByName;
  useEffect(() => {
    const query = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => { touchRef.current = query.matches; setTouch(query.matches); };
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  useEffect(() => { setSheet(null); }, [district, acNo]);
  const apiRef = useRef<{
    setSelection: (d: string | null, a: number | null, y: TnYearOrCurrent) => void;
    resetCamera: () => void;
    zoomBy: (factor: number) => void;
  } | null>(null);

  useEffect(() => {
    const host = hostRef.current, canvas = canvasRef.current, labelRoot = labelRef.current;
    if (!host || !canvas || !labelRoot) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const P = PAL[theme];
    ACTIVE_PARTY_COLORS = theme === "dark" ? partyColorsDark : partyColors;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 1, 9000);
    addMapLights(scene);
    const mapGroup = new THREE.Group(); scene.add(mapGroup);
    const resolution = new THREE.Vector2(1, 1);
    const projection = geoIdentity().reflectY(true).fitExtent([[70, 70], [BOX - 70, BOX - 70]], D_FC as never);
    const project = (p: [number, number]) => {
      const q = projection(p);
      if (!q) return [0, 0] as [number, number];
      if (!mapRotation) return [q[0], q[1]] as [number, number];
      const cos = Math.cos(mapRotation), sin = Math.sin(mapRotation);
      const dx = q[0] - CX, dy = q[1] - CZ;
      return [CX + dx * cos - dy * sin, CZ + dx * sin + dy * cos] as [number, number];
    };

    type Anim = { start: number; dur: number; fromO: number; toO: number; fromL: number; toL: number; fromY: number; toY: number };
    type Unit = {
      group: THREE.Group; mesh: THREE.Mesh; cap: THREE.MeshStandardMaterial; side: THREE.MeshStandardMaterial;
      line?: THREE.LineBasicMaterial; bounds: { minx: number; maxx: number; minz: number; maxz: number };
      label: HTMLSpanElement; name: string; kind: "district" | "ac"; key: string; no?: number;
      opacity: number; lineOpacity: number; y: number; targetOpacity: number; targetLine: number; targetY: number; targetVisible: boolean;
      emissiveHex?: string; anim?: Anim;
    };
    const districtsUnits = new Map<string, Unit>();
    const acUnits = new Map<number, Unit>();
    const acLayer = new Map<string, THREE.Group>();
    const pickables: THREE.Mesh[] = [];
    const labelEls: Unit[] = [];
    const acEdges = new Map<number, number[]>();
    const districtEdges = new Map<string, number[]>();
    const districtSeen = new Map<string, Set<string>>();
    const makeLabel = (text: string, kind: "district" | "ac") => {
      const el = document.createElement("span");
      el.textContent = text;
      el.style.position = "absolute"; el.style.pointerEvents = "none"; el.style.transform = "translate(-50%,-50%)";
      el.style.whiteSpace = "nowrap"; el.style.fontFamily = "inherit"; el.style.fontWeight = kind === "district" ? "600" : "500";
      if (kind === "district") el.style.textShadow = "0 0 2px rgba(255,255,255,.98), 0 0 4px rgba(255,255,255,.92)";
      el.style.fontSize = `${labelSize(kind === "district" ? "district" : "assembly", false).px}px`; el.style.fontWeight = String(labelSize(kind === "district" ? "district" : "assembly", false).weight); el.style.zIndex = kind === "district" ? "4" : "3";
      el.style.color = P.label; el.style.textShadow = `0 0 2px ${P.halo}`; el.style.userSelect = "none";
      el.style.transition = reduced ? "none" : "opacity .22s ease";
      labelRoot.appendChild(el);
      return el;
    };
    const addFeature = (f: AcFeature | DistrictFeature, kind: "district" | "ac") => {
      const shapes = shapeFor(f, project);
      if (!shapes.length) return null;
      const geo = new THREE.ExtrudeGeometry(shapes, { depth: kind === "district" ? DEPTH : AC_DEPTH, bevelEnabled: false, curveSegments: 1 });
      geo.rotateX(Math.PI / 2);
      geo.translate(0, kind === "district" ? DEPTH : DEPTH + 1, 0);
      const vertexCount = geo.getAttribute("position")?.count ?? 0;
      const defaultColors = new Float32Array(vertexCount * 3);
      for (let i = 0; i < defaultColors.length; i += 3) { defaultColors[i] = 1; defaultColors[i + 1] = 1; defaultColors[i + 2] = 1; }
      geo.setAttribute("color", new THREE.BufferAttribute(defaultColors, 3));
      const cap = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: MAP_STYLE.surface.roughness, metalness: MAP_STYLE.surface.metalness, side: THREE.DoubleSide, transparent: true, vertexColors: true });
      const side = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, metalness: MAP_STYLE.surface.metalness, side: THREE.DoubleSide, transparent: true, vertexColors: true });
      side.color.setScalar(MAP_STYLE.surface.sideDarken);
      const mesh = new THREE.Mesh(geo, [cap, side]);
      mesh.userData.kind = kind;
      if (kind === "district") mesh.userData.district = canonicalDistrict(f.properties.district);
      else { mesh.userData.no = (f as AcFeature).properties.no; mesh.userData.district = canonicalDistrict((f as AcFeature).properties.district); }
      mesh.castShadow = true; mesh.receiveShadow = true;
      pickables.push(mesh);
      const g = new THREE.Group(); g.add(mesh);
      let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
      const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
      for (const poly of polys) for (const ring of poly) {
        for (let i = 0; i < ring.length; i++) {
          const p = project([ring[i][0], ring[i][1]]);
          const px = p[0] - CX, pz = p[1] - CZ;
          minx = Math.min(minx, px); maxx = Math.max(maxx, px); minz = Math.min(minz, pz); maxz = Math.max(maxz, pz);
        }
      }
      const centroid = (f.properties as { centroid?: [number, number] }).centroid ?? [78.5, 11];
      const c = project(centroid);
      const name = kind === "district" ? canonicalDistrict((f.properties as DistrictFeature["properties"]).district) : (f as AcFeature).properties.name;
      const label = makeLabel(name, kind);
      const unit: Unit = {
        group: g, mesh, cap, side, bounds: { minx, maxx, minz, maxz }, label, name, kind,
        key: kind === "district" ? "d:" + name : "a:" + (f as AcFeature).properties.no, no: kind === "ac" ? (f as AcFeature).properties.no : undefined,
        opacity: 1, lineOpacity: kind === "district" ? 0.9 : 0, y: 0, targetOpacity: 1, targetLine: kind === "district" ? 0.9 : 0, targetY: 0, targetVisible: true,
      };
      label.dataset.cx = String(c[0] - CX); label.dataset.cz = String(c[1] - CZ);
      labelEls.push(unit);
      return unit;
    };
    const districtEdgeMap = new Map<string, { ax: number; az: number; bx: number; bz: number; count: number }>();
    const districtOuterByKey = new Map<string, number[]>();
    for (const f of D_FC.features) {
      const districtKey = canonicalDistrict(f.properties.district);
      const outerPts = districtOuterByKey.get(districtKey) ?? [];
      districtOuterByKey.set(districtKey, outerPts);
      const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
      for (const poly of polys) for (const ring of poly) {
        for (let i = 0; i < ring.length; i++) {
          const p = project([ring[i][0], ring[i][1]]); const q = project([ring[(i + 1) % ring.length][0], ring[(i + 1) % ring.length][1]]);
          const ax = p[0] - CX, az = p[1] - CZ, bx = q[0] - CX, bz = q[1] - CZ;
          const ka = `${ax.toFixed(3)},${az.toFixed(3)}`, kb = `${bx.toFixed(3)},${bz.toFixed(3)}`;
          const ek = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
          const e = districtEdgeMap.get(ek);
          if (e) e.count += 1; else districtEdgeMap.set(ek, { ax, az, bx, bz, count: 1 });
          outerPts.push(ax, BOUNDARY_Y, az, bx, BOUNDARY_Y, bz);
        }
      }
    }
    const stateOutlinePoints: number[] = [];
    const districtBoundaryPoints: number[] = [];
    for (const e of districtEdgeMap.values()) {
      const target = e.count === 1 ? stateOutlinePoints : districtBoundaryPoints;
      target.push(e.ax, DEPTH + 0.12, e.az, e.bx, DEPTH + 0.12, e.bz);
    }
    for (const f of D_FC.features) {
      const u = addFeature(f, "district");
      if (!u) continue;
      const districtKey = canonicalDistrict(f.properties.district);
      districtsUnits.set(districtKey, u);
      const layer = new THREE.Group(); layer.visible = false; u.group.add(layer); acLayer.set(districtKey, layer);
      mapGroup.add(u.group);
    }
    const stateBounds = { minx: Infinity, maxx: -Infinity, minz: Infinity, maxz: -Infinity };
    for (const u of districtsUnits.values()) {
      stateBounds.minx = Math.min(stateBounds.minx, u.bounds.minx); stateBounds.maxx = Math.max(stateBounds.maxx, u.bounds.maxx);
      stateBounds.minz = Math.min(stateBounds.minz, u.bounds.minz); stateBounds.maxz = Math.max(stateBounds.maxz, u.bounds.maxz);
    }
    let acBuilt = false;
    const buildAcs = () => {
      if (acBuilt) return;
      acBuilt = true;
    for (const f of AC_FC.features) {
      const districtKey = canonicalDistrict(f.properties.district);
      const layer = acLayer.get(districtKey);
      if (!layer) continue;
      const u = addFeature(f, "ac");
      if (!u) continue;
      acUnits.set(f.properties.no, u);
      layer.add(u.group);
      const acPts: number[] = [];
      const dPts = districtEdges.get(districtKey) ?? [];
      const seen = districtSeen.get(districtKey) ?? new Set<string>();
      districtSeen.set(districtKey, seen);
      for (const poly of (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][]) for (const ring of poly) {
        for (let i = 0; i < ring.length; i++) {
          const p = project([ring[i][0], ring[i][1]]); const q = project([ring[(i + 1) % ring.length][0], ring[(i + 1) % ring.length][1]]);
          const ax = p[0] - CX, az = p[1] - CZ, bx = q[0] - CX, bz = q[1] - CZ;
          acPts.push(ax, BOUNDARY_Y, az, bx, BOUNDARY_Y, bz);
          const ka = `${ax.toFixed(3)},${az.toFixed(3)}`, kb = `${bx.toFixed(3)},${bz.toFixed(3)}`;
          const ek = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
          if (!seen.has(ek)) { seen.add(ek); dPts.push(ax, BOUNDARY_Y, az, bx, BOUNDARY_Y, bz); }
        }
      }
      acEdges.set(f.properties.no, acPts);
      if (!districtEdges.has(districtKey)) districtEdges.set(districtKey, dPts);
    }

    };
    const boundary = createScreenLine([], P.line, MAP_STYLE.border.assembly, resolution, 0);
    const accent = createScreenLine([], P.sel, MAP_STYLE.border.selected, resolution, 1);
    const stateOutline = createScreenLine(stateOutlinePoints, P.line, MAP_STYLE.border.state, resolution, 0.82);
    const districtBoundary = createScreenLine(districtBoundaryPoints, P.line, MAP_STYLE.border.district, resolution, 0.58);
    const districtAccent = createScreenLine([], P.sel, MAP_STYLE.border.selected, resolution, 1);
    boundary.line.renderOrder = 22; accent.line.renderOrder = 24; stateOutline.line.renderOrder = 18; districtBoundary.line.renderOrder = 19; districtAccent.line.renderOrder = 25;
    boundary.line.visible = false; accent.line.visible = false; districtAccent.line.visible = false;
    mapGroup.add(boundary.line, accent.line, stateOutline.line, districtBoundary.line, districtAccent.line);
    const setPositions = (line: typeof boundary, pts: number[]) => setScreenLinePoints(line, pts);
    const showAccent = (no: number | null, selected = false) => {
      if (no == null || !acEdges.has(no)) { accent.line.visible = false; return; }
      setPositions(accent, acEdges.get(no)!);
      accent.material.color.set(selected ? P.sel : P.hover);
      accent.material.linewidth = selected ? MAP_STYLE.border.selected : MAP_STYLE.border.assembly + 0.15;
      accent.material.opacity = selected ? 1 : 0.9;
      accent.line.position.y = (selected ? SELECTED_LIFT : AC_LIFT) - 2;
      accent.line.visible = true;
    };

    let stateDist = 1400;
    let cam = { tx: 0, tz: 0, ty: 0, dist: 2050, theta: 0, phi: stateTilt };
    let camTarget = { ...cam };
    let camAnim: { start: number; dur: number; from: typeof cam } | null = null;
    const startCamera = (target: typeof cam) => {
      const same = Math.abs(target.tx - camTarget.tx) < 0.01 && Math.abs(target.tz - camTarget.tz) < 0.01 && Math.abs(target.ty - camTarget.ty) < 0.01 && Math.abs(target.dist - camTarget.dist) < 0.01;
      camTarget = target;
      if (same && !camAnim) return;
      camAnim = { start: performance.now(), dur: reduced ? 0 : ANIM_MS, from: { ...cam } };
    };

    let hoveredKey: string | null = null;
    let hoveredNo: number | null = null;
    let boundaryTarget = 0;
    let boundaryOpacity = 0;
    let boundaryStart = 0;
    let boundaryFrom = 0;
    let districtTarget = 0.82;
    let districtOpacity = 0.82;
    let districtStart = 0;
    let districtFrom = 0.82;
    const startBoundary = (target: number) => { boundaryTarget = target; boundaryFrom = boundaryOpacity; boundaryStart = performance.now(); if (reduced) { boundaryOpacity = target; } };
    const startDistrictOutline = (target: number) => { districtTarget = target; districtFrom = districtOpacity; districtStart = performance.now(); if (reduced) { districtOpacity = target; } };
    const startUnit = (u: Unit, targetO: number, targetL: number, targetY: number, targetVisible: boolean) => {
      const now = performance.now();
      u.anim = { start: now, dur: reduced ? 0 : ANIM_MS, fromO: u.opacity, toO: targetO, fromL: u.lineOpacity, toL: targetL, fromY: u.y, toY: targetY };
      u.targetOpacity = targetO; u.targetLine = targetL; u.targetY = targetY; u.targetVisible = targetVisible;
      if (targetVisible || u.opacity > 0.01) u.group.visible = true;
      if (targetVisible || u.opacity > 0.01) u.mesh.visible = true;
    };
    const updateUnit = (u: Unit, now: number) => {
      if (u.anim) {
        const t = u.anim.dur <= 0 ? 1 : Math.max(0, Math.min(1, (now - u.anim.start) / u.anim.dur));
        const e = easeOut(t);
        u.opacity = lerp(u.anim.fromO, u.anim.toO, e);
        u.lineOpacity = lerp(u.anim.fromL, u.anim.toL, e);
        u.y = lerp(u.anim.fromY, u.anim.toY, e);
        if (t >= 1) u.anim = undefined;
      }
      u.cap.opacity = u.opacity; u.side.opacity = u.opacity;
      u.mesh.position.y = u.y;
      if (u.line) u.line.opacity = u.lineOpacity;
      if (u.line) u.line.visible = u.lineOpacity > 0.01;
      u.mesh.visible = (u.targetVisible && u.targetOpacity > 0.01) || u.opacity > 0.01;
      u.group.visible = u.targetVisible || u.opacity > 0.01;
    };
    const updateBoundary = (now: number) => {
      if (boundaryStart) {
        const t = reduced ? 1 : Math.max(0, Math.min(1, (now - boundaryStart) / ANIM_MS));
        boundaryOpacity = lerp(boundaryFrom, boundaryTarget, easeOut(t));
        if (t >= 1) boundaryStart = 0;
      }
      boundary.material.opacity = boundaryOpacity;
      boundary.line.visible = boundaryOpacity > 0.01;
      boundary.line.position.y = boundaryOpacity > 0.01 ? AC_LIFT - 2 : 0;
      if (districtStart) {
        const t = reduced ? 1 : Math.max(0, Math.min(1, (now - districtStart) / ANIM_MS));
        districtOpacity = lerp(districtFrom, districtTarget, easeOut(t));
        if (t >= 1) districtStart = 0;
      }
      stateOutline.material.opacity = districtOpacity;
      districtBoundary.material.opacity = districtOpacity * 0.72;
      stateOutline.line.visible = districtOpacity > 0.01;
      districtBoundary.line.visible = districtOpacity > 0.01;
    };

    const gradientAxis = new THREE.Vector2(0.86, 0.5).normalize();
    const applyGradient = (u: Unit, blend: BlendInfo) => {
      const geo = u.mesh.geometry;
      const position = geo.getAttribute("position");
      if (!position) return;
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), z = position.getZ(i);
        const t = x * gradientAxis.x + z * gradientAxis.y;
        lo = Math.min(lo, t); hi = Math.max(hi, t);
      }
      const colors = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), z = position.getZ(i);
        const t = hi > lo ? ((x * gradientAxis.x + z * gradientAxis.y) - lo) / (hi - lo) : 0.5;
        const c = blendColor(blend, t);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      u.cap.color.set("#ffffff"); u.side.color.set("#ffffff");
      u.cap.vertexColors = true; u.side.vertexColors = true;
      u.emissiveHex = blend.first ? blend.color1 : "#000000";
      u.cap.needsUpdate = true; u.side.needsUpdate = true;
    };
    const setAcEmissive = (no: number | null, hover: boolean) => {
      if (no == null) return;
      const u = acUnits.get(no);
      if (!u) return;
      const selected = live.current.acNo === no;
      u.cap.emissive.set(u.emissiveHex ?? "#000000");
      u.cap.emissiveIntensity = selected ? MAP_STYLE.surface.selectedEmissive : hover ? MAP_STYLE.surface.hoverEmissive : 0;
    };

    apiRef.current = {
      setSelection: (d, a, y) => {
        if (d || a != null) buildAcs();
        const activeD = d ? districtsUnits.get(d) : null;
        const activeAC = a != null ? acUnits.get(a) : null;
        hoveredKey = null; hoveredNo = null; setTip(null); canvas.style.cursor = "grab";
        showAccent(activeAC?.no ?? null, !!activeAC);
        const mobileState = typeof window !== "undefined" && window.innerWidth < 640;
        const mobileLabels = new Set([...mobileForcedLabels, ...[...districtsUnits.keys()].sort((aKey, bKey) => (districtRef.current.get(bKey)?.survey.valid ?? 0) - (districtRef.current.get(aKey)?.survey.valid ?? 0)).slice(0, mobileLabelCount)]);
        const assembly = false;
        for (const [name, u] of districtsUnits) {
          const selected = !!activeD && name === activeD.name;
          const acLayerGroup = acLayer.get(name); if (acLayerGroup) acLayerGroup.visible = !!activeD && selected;
          const blend = blendForDistrict(districtRef.current.get(canonicalDistrict(name)), y);
          applyGradient(u, blend);
          startUnit(u, activeD ? 0 : 1, activeD ? 0 : 0.9, 0, activeD ? selected : true);
          u.label.style.opacity = activeD ? (selected && !activeAC ? "1" : "0") : assembly ? "0" : (mobileState && !mobileLabels.has(name) ? "0" : "1");
          const size = labelSize(selected ? "district" : "district", mobileState);
          u.label.style.fontSize = `${size.px}px`; u.label.style.fontWeight = String(size.weight);
        }
        for (const [no, u] of acUnits) {
          const blend = blendForAc(acRef.current.get(no), y);
          const acSelected = !!activeAC && no === activeAC.no;
          const inSelectedDistrict = !!activeD && canonicalDistrict(u.mesh.userData.district) === activeD.name;
          const visible = assembly
            ? activeAC ? acSelected : activeD ? inSelectedDistrict : true
            : !!activeD && (activeAC ? acSelected : inSelectedDistrict);
          applyGradient(u, blend);
          u.cap.emissive.set(acSelected && blend.first ? blend.color1 : "#000000");
          u.cap.emissiveIntensity = acSelected ? MAP_STYLE.surface.selectedEmissive : 0;
          startUnit(u, visible ? 1 : 0, 0, activeD || assembly ? (acSelected ? SELECTED_LIFT : AC_LIFT) : 0, visible);
          u.label.style.opacity = visible && (activeD || acSelected || !assembly) ? "1" : "0";
          const acSize = labelSize(acSelected ? "selectedAssembly" : "assembly", mobileState);
          u.label.style.fontSize = `${acSize.px}px`; u.label.style.fontWeight = String(acSize.weight);
        }
        if (activeD && !activeAC && districtEdges.has(activeD.name)) setPositions(boundary, districtEdges.get(activeD.name)!);
        boundary.line.visible = !!activeD && !activeAC;
        startBoundary(activeD && !activeAC ? 0.62 : 0);
        startDistrictOutline(activeD ? 0 : 0.82);
        const districtOutlinePointsSelected = activeD && !activeAC ? districtOuterByKey.get(activeD.name) ?? [] : [];
        if (districtOutlinePointsSelected.length) {
          setScreenLinePoints(districtAccent, districtOutlinePointsSelected);
          districtAccent.line.visible = true;
          districtAccent.line.position.y = AC_LIFT - 2;
        } else districtAccent.line.visible = false;
        // Camera framing: keep side panels clear; focus the selected scope.
        let bounds: { minx: number; maxx: number; minz: number; maxz: number } | null = null;
        if (activeAC) bounds = activeAC.bounds;
        else if (activeD) bounds = activeD.bounds;
        else bounds = stateBounds;
        const hostRect = host.getBoundingClientRect();
        const vw = Math.max(320, hostRect.width), vh = Math.max(320, hostRect.height);
        const wide = typeof window !== "undefined" && window.innerWidth > 1024;
        let centerX = 0, centerZ = 0, dist = 1450;
        const phi = activeAC || activeD ? 0.58 : stateTilt;
        if (bounds && Number.isFinite(bounds.minx)) {
          centerX = (bounds.minx + bounds.maxx) / 2; centerZ = (bounds.minz + bounds.maxz) / 2;
          const W = Math.max(1, bounds.maxx - bounds.minx), H = Math.max(1, bounds.maxz - bounds.minz);
          const availW = Math.max(220, vw - (wide ? 34 : 30));
          const availH = Math.max(220, vh - (activeAC || activeD ? 96 : 74));
          const fov = camera.fov * Math.PI / 180;
          const fit = Math.max((H / 2) / Math.tan(fov / 2), (W / 2) / Math.tan(Math.atan(Math.tan(fov / 2) * (availW / availH)))) * (activeAC ? 1.32 : activeD ? 1.28 : Math.cos(phi) * (vh / availH) * 1.05);
          dist = Math.max(45, Math.min(3600, fit));
        }
        if (!activeD && !activeAC) { dist *= stateFit; stateDist = dist; centerZ += stateCenterZ; }
        startCamera({ tx: centerX, tz: centerZ, ty: activeAC ? 2.2 : activeD ? 0.8 : 0, dist, theta: 0, phi });
      },
      resetCamera: () => {
        const width = Math.max(280, host.getBoundingClientRect().width);
        const dist = Math.max(1100, Math.min(2600, 1800 * (700 / width)));
        startCamera({ tx: 0, tz: stateCenterZ, ty: 0, dist, theta: 0, phi: stateTilt });
      },
      zoomBy: (factor: number) => {
        if (factor < 1 && !live.current.district) {
          const r = canvas.getBoundingClientRect();
          const hit = hitAt(r.left + r.width / 2, r.top + r.height / 2);
          if (hit && hit.object.userData.kind === "district") { live.current.onSelectDistrict(canonicalDistrict(hit.object.userData.district as string)); return; }
        }
        if (factor > 1 && live.current.district && camTarget.dist * factor >= stateDist * 0.92) { live.current.onReset(); return; }
        startCamera({ ...camTarget, dist: Math.max(35, Math.min(3300, camTarget.dist * factor)) });
      },
    };
    apiRef.current?.setSelection(live.current.district, live.current.acNo, live.current.year);
    setReady(true);

    let raf = 0, disposed = false;
    let drag: { x: number; y: number; moved: boolean } | null = null;
    const pointers = new Set<number>();
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
    const updateCamera = (now: number) => {
      if (camAnim) {
        const t = camAnim.dur <= 0 ? 1 : Math.max(0, Math.min(1, (now - camAnim.start) / camAnim.dur));
        const e = easeOut(t);
        cam = {
          tx: lerp(camAnim.from.tx, camTarget.tx, e), tz: lerp(camAnim.from.tz, camTarget.tz, e), ty: lerp(camAnim.from.ty, camTarget.ty, e),
          dist: lerp(camAnim.from.dist, camTarget.dist, e), theta: lerp(camAnim.from.theta, camTarget.theta, e), phi: lerp(camAnim.from.phi, camTarget.phi, e),
        };
        if (t >= 1) camAnim = null;
      }
      camera.position.set(cam.tx + cam.dist * Math.sin(cam.phi) * Math.sin(cam.theta), cam.ty + cam.dist * Math.cos(cam.phi), cam.tz + cam.dist * Math.sin(cam.phi) * Math.cos(cam.theta));
      camera.lookAt(cam.tx, cam.ty, cam.tz);
    };
    const resize = () => {
      const r = host.getBoundingClientRect(); renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
      camera.aspect = Math.max(0.2, r.width / Math.max(1, r.height)); camera.updateProjectionMatrix();
      for (const line of [boundary, accent, stateOutline, districtBoundary, districtAccent]) updateLineResolution(line, r.width, r.height);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(host);
    let lastFrame = 0;
    const render = (now: number) => {
      if (now - lastFrame < 32 || document.visibilityState !== "visible") { if (!disposed) raf = requestAnimationFrame(render); return; }
      lastFrame = now;
      updateCamera(now);
      for (const u of labelEls) updateUnit(u, now);
      updateBoundary(now);
      const rect = host.getBoundingClientRect();
      const boxes: { l: number; r: number; t: number; b: number }[] = [];
      const ordered = [...labelEls].sort((a, b) => {
        const va = a.kind === "district" ? Math.min(80, (districtRef.current.get(a.name)?.survey.valid ?? 0) / 8000) : 0;
        const vb = b.kind === "district" ? Math.min(80, (districtRef.current.get(b.name)?.survey.valid ?? 0) / 8000) : 0;
        const pa = (a.kind === "ac" && a.no === live.current.acNo ? 100 : 0) + (a.kind === "ac" && a.no === hoveredNo ? 90 : 0) + (a.kind === "ac" ? 50 : a.name === live.current.district ? 95 : 10) + va;
        const pb = (b.kind === "ac" && b.no === live.current.acNo ? 100 : 0) + (b.kind === "ac" && b.no === hoveredNo ? 90 : 0) + (b.kind === "ac" ? 50 : b.name === live.current.district ? 95 : 10) + vb;
        return pb - pa;
      });
      for (const u of ordered) {
        if (u.label.style.opacity === "0") { u.label.style.visibility = "hidden"; continue; }
        const x = Number(u.label.dataset.cx || 0), z = Number(u.label.dataset.cz || 0);
        const p = new THREE.Vector3(x, (u.kind === "district" ? DEPTH : DEPTH + AC_DEPTH) + u.y, z).project(camera);
        const sx = (p.x * 0.5 + 0.5) * rect.width, sy = (-p.y * 0.5 + 0.5) * rect.height;
        const size = parseFloat(u.label.style.fontSize || "9");
        const w = Math.max(20, (u.label.textContent?.length ?? 4) * size * 0.62 + 10), h = size + 7;
        let dx = 0, dy = 0;
        const baseBox = { l: sx - w / 2 - 3, r: sx + w / 2 + 3, t: sy - h / 2 - 3, b: sy + h / 2 + 3 };
        if (u.kind === "district") {
          const base = (window.innerWidth < 640 ? mobileLabelOffset[u.name] : undefined) ?? labelOffset[u.name] ?? { x: 0, y: 0 };
          const candidate = [
            { x: base.x, y: base.y },
            { x: base.x + 40, y: base.y }, { x: base.x - 40, y: base.y },
            { x: base.x, y: base.y - 20 }, { x: base.x, y: base.y + 20 },
            { x: base.x + 36, y: base.y - 16 }, { x: base.x - 36, y: base.y + 16 },
            { x: base.x + 36, y: base.y + 16 }, { x: base.x - 36, y: base.y - 16 },
          ].find((offset) => {
            const l = baseBox.l + offset.x, r = baseBox.r + offset.x, t = baseBox.t + offset.y, b = baseBox.b + offset.y;
            return l >= 2 && r <= rect.width - 2 && t >= 2 && b <= rect.height - 2 && !boxes.some((other) => l < other.r && r > other.l && t < other.b && b > other.t);
          });
          if (candidate) { dx = candidate.x; dy = candidate.y; }
          else {
            const seed = [...u.name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
            dx = base.x + (seed % 2 === 0 ? 1 : -1) * 22;
            dy = base.y + (seed % 3 - 1) * 18;
          }
        }
        const halfW = w / 2 + 3, halfH = h / 2 + 3;
        const px = Math.min(rect.width - halfW, Math.max(halfW, sx + dx));
        const py = Math.min(rect.height - halfH, Math.max(halfH, sy + dy));
        const box = { l: px - halfW, r: px + halfW, t: py - halfH, b: py + halfH };
        const collides = boxes.some((b) => box.l < b.r && box.r > b.l && box.t < b.b && box.b > b.t);
        if (collides && (u.kind === "ac" ? u.no !== live.current.acNo : avoidDistrictCollisions && u.name !== live.current.district)) { u.label.style.visibility = "hidden"; continue; }
        boxes.push(box);
        u.label.style.visibility = "visible";
        u.label.style.transform = `translate(${px}px,${py}px) translate(-50%,-50%)`;
      }
      renderer.render(scene, camera);
      if (!disposed) raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    const unitFor = (obj: THREE.Object3D): Unit | undefined => {
      const data = obj.userData;
      return data.kind === "district" ? districtsUnits.get(canonicalDistrict(data.district as string)) : acUnits.get(data.no as number);
    };
    const visibleInHierarchy = (obj: THREE.Object3D) => {
      let cur: THREE.Object3D | null = obj;
      while (cur) { if (!cur.visible) return false; cur = cur.parent; }
      return true;
    };
    const pickable = (hit: THREE.Intersection) => {
      const u = unitFor(hit.object);
      return !!u && u.targetVisible && u.opacity > 0.04 && visibleInHierarchy(hit.object);
    };
    const hitAt = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect();
      ndc.x = ((clientX - r.left) / r.width) * 2 - 1; ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      return ray.intersectObjects(pickables.filter((m) => visibleInHierarchy(m)), false).filter(pickable)[0] ?? null;
    };
    const restoreSelectedAccent = () => showAccent(live.current.acNo, true);
    const onPointerMove = (e: PointerEvent) => {
      if (touchRef.current) return;
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
        camAnim = null;
        cam.theta = Math.max(-0.6, Math.min(0.6, cam.theta - dx * 0.004));
        cam.phi = Math.max(0.25, Math.min(1.1, cam.phi + dy * 0.003));
        camTarget = { ...cam };
        drag.x = e.clientX; drag.y = e.clientY; return;
      }
      const hit = hitAt(e.clientX, e.clientY);
      if (!hit) {
        if (hoveredKey) { if (hoveredNo != null) setAcEmissive(hoveredNo, false); hoveredKey = null; hoveredNo = null; restoreSelectedAccent(); }
        canvas.style.cursor = "grab"; setTip(null); return;
      }
      const data = hit.object.userData; const kind = data.kind as "district" | "ac";
      const key = kind === "district" ? "d:" + data.district : "a:" + data.no;
      if (key !== hoveredKey) {
        if (hoveredNo != null) setAcEmissive(hoveredNo, false);
        hoveredKey = key; hoveredNo = kind === "ac" ? data.no as number : null;
        if (hoveredNo != null) setAcEmissive(hoveredNo, true);
        canvas.style.cursor = "pointer";
        if (kind === "district") {
          showAccent(live.current.acNo, true);
          const name = canonicalDistrict(data.district);
          const custom = live.current.tooltip?.({ kind: "district", name });
          setTip({ x: e.clientX, y: e.clientY, card: custom ?? { title: name, leader: null, rows: [] } });
        } else {
          showAccent(data.no as number, data.no === live.current.acNo);
          const a = acRef.current.get(data.no as number);
          const name = a?.name ?? `AC ${data.no}`;
          const custom = live.current.tooltip?.({ kind: "ac", name, no: data.no as number, district: canonicalDistrict(data.district) });
          setTip({ x: e.clientX, y: e.clientY, card: custom ?? { title: name, leader: null, rows: [] } });
        }
      } else setTip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : t);
    };
    const onPointerDown = (e: PointerEvent) => {
      pointers.add(e.pointerId);
      if (e.pointerType === "touch") { if (pointers.size > 1 && drag) drag.moved = true; if (pointers.size === 1) drag = null; return; }
      if (pointers.size > 1) { if (drag) drag.moved = true; return; }
      drag = { x: e.clientX, y: e.clientY, moved: false };
      canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing";
    };
    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      const wasDrag = drag?.moved; drag = null; canvas.style.cursor = "grab";
      if (wasDrag || pointers.size > 0) return;
      const hit = hitAt(e.clientX, e.clientY);
      if (!hit) {
        hoveredKey = null; hoveredNo = null; setTip(null); restoreSelectedAccent();
        if (touchRef.current) setSheet(null);
        else live.current.onReset();
        return;
      }
      const data = hit.object.userData as { kind: "district" | "ac"; district?: string; no?: number };
      if (touchRef.current) {
        const kind = data.kind;
        const name = kind === "district" ? canonicalDistrict(data.district ?? "") : acRef.current.get(data.no as number)?.name ?? `AC ${data.no}`;
        const card = live.current.tooltip?.({ kind, name, no: data.no, district: data.district ? canonicalDistrict(data.district) : undefined }) ?? { title: name, leader: null, rows: [] };
        setSheet({ card, kind, name, no: data.no, district: data.district ? canonicalDistrict(data.district) : undefined });
        return;
      }
      if (data.kind === "district") live.current.onSelectDistrict(canonicalDistrict(data.district ?? ""));
      else live.current.onSelectAc(data.no as number);
    };
    const onPointerCancel = (e: PointerEvent) => { pointers.delete(e.pointerId); drag = null; canvas.style.cursor = "grab"; };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = 1 + e.deltaY * 0.0012;
      const next = Math.max(35, Math.min(3300, camTarget.dist * factor));
      if (factor < 1 && !live.current.district) {
        const hit = hitAt(e.clientX, e.clientY);
        if (hit && hit.object.userData.kind === "district") { live.current.onSelectDistrict(canonicalDistrict(hit.object.userData.district as string)); return; }
      }
      if (factor > 1 && live.current.district && next >= stateDist * 0.92) { live.current.onReset(); return; }
      startCamera({ ...camTarget, dist: next });
    };
    let touchState: { startDist: number; startMidX: number; startMidY: number; dist: number; theta: number; phi: number } | null = null;
    const touchDistance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const touchMid = (touches: TouchList) => ({ x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 });
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length < 2) { touchState = null; return; }
      e.preventDefault();
      const mid = touchMid(e.touches);
      touchState = { startDist: Math.max(1, touchDistance(e.touches)), startMidX: mid.x, startMidY: mid.y, dist: camTarget.dist, theta: cam.theta, phi: cam.phi };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length < 2 || !touchState) return;
      e.preventDefault();
      const mid = touchMid(e.touches);
      const scale = touchState.startDist / Math.max(1, touchDistance(e.touches));
      cam.dist = Math.max(35, Math.min(3300, touchState.dist * scale));
      cam.theta = Math.max(-0.6, Math.min(0.6, touchState.theta - (mid.x - touchState.startMidX) * 0.003));
      cam.phi = Math.max(0.25, Math.min(1.1, touchState.phi + (mid.y - touchState.startMidY) * 0.002));
      camTarget = { ...cam };
    };
    const onTouchEnd = () => { touchState = null; };
    const onLeave = () => { if (hoveredNo != null) setAcEmissive(hoveredNo, false); hoveredKey = null; hoveredNo = null; setTip(null); restoreSelectedAccent(); drag = null; pointers.clear(); canvas.style.cursor = "grab"; };
    canvas.addEventListener("pointermove", onPointerMove); canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp); canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("pointerleave", onLeave); canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd); canvas.addEventListener("touchcancel", onTouchEnd);
    return () => {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove); canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp); canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onLeave); canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart); canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd); canvas.removeEventListener("touchcancel", onTouchEnd);
      labelRoot.innerHTML = ""; renderer.dispose();
    };
  }, [theme]);

  useEffect(() => {
    if (!ready) return;
    apiRef.current?.setSelection(district, acNo, year);
  }, [ready, district, acNo, year, acs, districts, fitKey]);

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block h-full w-full" style={{ touchAction: "pan-y pinch-zoom" }} aria-label="3D map of districts and assembly constituencies" role="img" />
        <div ref={labelRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden />
      </div>
      <div className="absolute right-2 top-2 z-10 flex flex-col overflow-hidden rounded-lg border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)]/95 shadow-sm">
        <button type="button" aria-label="Zoom in" onClick={() => apiRef.current?.zoomBy(0.8)} className="grid size-11! place-items-center text-[20px] font-semibold text-[color:var(--theme-text)] hover:bg-[color:var(--theme-surface-2)]">+</button>
        <button type="button" aria-label="Zoom out" onClick={() => apiRef.current?.zoomBy(1.25)} className="grid size-11! place-items-center border-t border-[color:var(--theme-border)] text-[20px] font-semibold text-[color:var(--theme-text)] hover:bg-[color:var(--theme-surface-2)]">−</button>
      </div>
      <p className="pointer-events-none absolute bottom-2 right-2 z-10 rounded bg-[color:var(--theme-surface)]/85 px-2 py-1 text-[12px] text-[color:var(--theme-text-3)]">{touch ? "Pinch to zoom" : "Ctrl + scroll to zoom"}</p>
      {tip && (() => {
        const width = 232;
        const height = 48 + tip.card.rows.length * 23;
        const viewportW = typeof window === "undefined" ? 1440 : window.innerWidth;
        const viewportH = typeof window === "undefined" ? 900 : window.innerHeight;
        const left = tip.x + 12 + width > viewportW - 8 ? Math.max(8, tip.x - 12 - width) : tip.x + 12;
        const top = tip.y + 12 + height > viewportH - 8 ? Math.max(8, tip.y - 12 - height) : tip.y + 12;
        return (
          <div data-testid="map-tooltip" className="tn-tooltip pointer-events-none fixed z-[var(--z-dropdown)] rounded-2xl border border-[#E4E4E7] bg-[color:var(--theme-surface)] p-3 shadow-[0_18px_46px_-18px_rgba(0,0,0,0.35)]" style={{ left, top, width, borderLeft: `4px solid ${ACTIVE_PARTY_COLORS[tip.card.leader ?? ""] ?? noDataColor}` }}>
            <div className="flex items-center gap-2 border-b border-[#F0F0F0] pb-2">
              {tip.card.leader && <PartyBadge party={tip.card.leader} size={20} />}
              <span className="min-w-0 truncate text-[14px] font-semibold text-[color:var(--theme-text)]">{tip.card.title}</span>
            </div>
            {tip.card.rows.length ? (
              <ul className="mt-1.5 space-y-0.5">
                {tip.card.rows.map((row) => (
                  <li key={row.party} className={row.party === tip.card.leader ? "flex items-center gap-1.5 text-[13px] font-bold text-[color:var(--theme-text)]" : "flex items-center gap-1.5 text-[13px] text-[color:var(--theme-text-2)]"}>
                    <PartyBadge party={row.party} size={20} />
                    <span className="size-2 rounded-[2px]" style={{ background: ACTIVE_PARTY_COLORS[row.party] ?? noDataColor }} aria-hidden />
                    <span className="flex-1 truncate">{row.party}</span>
                    <span className="tabular-nums">{row.value.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-[13px] text-[color:var(--theme-text-3)]">No data / under 30</p>
            )}
          </div>
        );
      })()}
      {touch && sheet && (
        <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-2xl border-t border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-4 shadow-[0_-12px_40px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {sheet.card.leader && <PartyBadge party={sheet.card.leader} size={24} />}
              <p className="truncate text-[14px] font-semibold text-[color:var(--theme-text)]">{sheet.card.title}</p>
            </div>
            <button type="button" onClick={() => setSheet(null)} aria-label="Close map details" className="grid size-11 place-items-center rounded-full text-[color:var(--theme-text-3)] hover:bg-[color:var(--theme-surface-2)]"><X className="size-4" /></button>
          </div>
          {sheet.card.rows.length ? (
            <ul className="mt-2 space-y-1">
              {sheet.card.rows.map((row) => (
                <li key={row.party} className={row.party === sheet.card.leader ? "flex items-center gap-2 text-[12px] font-bold text-[color:var(--theme-text)]" : "flex items-center gap-2 text-[12px] text-[color:var(--theme-text-2)]"}>
                  <PartyBadge party={row.party} size={20} />
                  <span className="size-2 rounded-[2px]" style={{ background: ACTIVE_PARTY_COLORS[row.party] ?? noDataColor }} aria-hidden />
                  <span className="flex-1">{row.party}</span>
                  <span className="tabular-nums">{row.value.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[12px] text-[color:var(--theme-text-3)]">No data / under 30</p>}
          <button
            type="button"
            onClick={() => { if (sheet.kind === "district") onSelectDistrict(sheet.name); else if (sheet.no != null) onSelectAc(sheet.no); setSheet(null); }}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[color:var(--theme-selected)] px-4 text-[13px] font-semibold text-white"
          >
            {sheet.kind === "district" ? "View constituencies" : "View constituency"}
          </button>
        </div>
      )}
      <div className="sr-only" aria-live="polite">{tip ? `${tip.card.title}: ${tip.card.rows.map((row) => `${row.party} ${row.value.toFixed(1)}%`).join(", ")}` : ""}</div>
    </div>
  );
}
