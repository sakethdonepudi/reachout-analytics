"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { geoIdentity } from "d3-geo";
import AC_GEO from "@/lib/data/tamil-nadu/tn-acs.json";
import DISTRICT_GEO from "@/lib/data/tamil-nadu/tn-districts.json";
import {
  TN_COLOR, TN_GROUPS, TN_LABEL, TN_NO_DATA, tnPct,
  type TnAc, type TnDistrict, type TnGroup, type TnShares, type TnYearOrCurrent,
} from "@/lib/tamil-nadu/model";

export type MapTheme = "light" | "dark";
export type MapMode = "state" | "district";

const BOX = 1000;
const DEPTH = 10;
const AC_DEPTH = 3;
const AC_LIFT = 1.6;
const SELECTED_LIFT = 3.6;
const BOUNDARY_Y = DEPTH + AC_DEPTH + 0.16;
const ANIM_MS = 720;
const CX = BOX / 2;
const CZ = BOX / 2;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type AcFeature = { type: "Feature"; properties: { no: number; name: string; district: string; centroid?: [number, number] }; geometry: { type: string; coordinates: unknown } };
type DistrictFeature = { type: "Feature"; properties: { district: string; centroid?: [number, number] }; geometry: { type: string; coordinates: unknown } };
type FC = { type: "FeatureCollection"; features: AcFeature[] };
type DFC = { type: "FeatureCollection"; features: DistrictFeature[] };
const AC_FC = AC_GEO as unknown as FC;
const D_FC = DISTRICT_GEO as unknown as DFC;

const DISTRICT_ALIAS: Record<string, string> = {
  Kanyakumari: "Kanniyakumari", Nilgiris: "The Nilgiris", Thiruvarur: "Tiruvarur", Thoothukkudi: "Thoothukudi", Viluppuram: "Villupuram",
};
const canonicalDistrict = (name: string) => DISTRICT_ALIAS[name] ?? name;

type Props = {
  acs: TnAc[];
  districts: TnDistrict[];
  district: string | null;
  acNo: number | null;
  year: TnYearOrCurrent;
  theme: MapTheme;
  onSelectDistrict: (name: string) => void;
  onSelectAc: (no: number) => void;
  onReset: () => void;
};

const PAL = {
  dark: {
    none: "#2b3442", side: "#1c2531", line: "rgba(210,222,238,.55)", hover: "#93c5fd",
    sel: "#ffffff", label: "#e8edf4", halo: "rgba(6,10,18,.88)", bg: "rgba(16,22,30,.97)", border: "rgba(120,135,155,.35)",
  },
  light: {
    none: "#e7ebef", side: "#d3d9e0", line: "rgba(40,58,78,.50)", hover: "#1d4ed8",
    sel: "#111827", label: "#1b2430", halo: "rgba(255,255,255,.94)", bg: "rgba(255,255,255,.98)", border: "rgba(20,24,31,.14)",
  },
};
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
  first: TnGroup | null; second: TnGroup | null;
  firstShare: number | null; secondShare: number | null;
  p1: number; p2: number; marginPp: number | null;
  color1: string; color2: string; color: string; label: string;
};
function blendFromShares(shares: TnShares | null | undefined, label: string): BlendInfo {
  const ranked = TN_GROUPS
    .map((g) => ({ g, v: Math.max(0, shares?.[g] ?? 0) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);
  if (!ranked.length) return { first: null, second: null, firstShare: null, secondShare: null, p1: 0, p2: 0, marginPp: null, color1: TN_NO_DATA, color2: TN_NO_DATA, color: TN_NO_DATA, label: "No data" };
  const first = ranked[0]; const second = ranked[1] ?? null;
  const total = first.v + (second?.v ?? 0) || 1;
  const p1 = first.v / total; const p2 = second ? second.v / total : 0;
  return {
    first: first.g, second: second?.g ?? null,
    firstShare: first.v, secondShare: second?.v ?? null,
    p1, p2, marginPp: second ? Math.max(0, (first.v - second.v) * 100) : 100,
    color1: TN_COLOR[first.g], color2: second ? TN_COLOR[second.g] : TN_COLOR[first.g],
    color: TN_COLOR[first.g], label,
  };
}
function blendForAc(a: TnAc | undefined, year: TnYearOrCurrent): BlendInfo {
  if (!a) return blendFromShares(null, "No data");
  if (year === "2026") return blendFromShares(a.survey.shares, "2026 estimate");
  const rec = a.historical[year];
  return blendFromShares(rec.shares, `${year} result`);
}
function blendForDistrict(d: TnDistrict | undefined, year: TnYearOrCurrent): BlendInfo {
  if (!d) return blendFromShares(null, "No data");
  if (year === "2026") return blendFromShares(d.survey.shares, "2026 estimate");
  return blendFromShares(d.historical[year].shares, `${year} result`);
}
function blendColor(blend: BlendInfo, t: number): THREE.Color {
  if (!blend.first) return new THREE.Color(TN_NO_DATA);
  if (!blend.second) return new THREE.Color(blend.color1);
  // Keep broad recognizable zones and a soft transition around the lead split.
  const center = Math.max(0.12, Math.min(0.88, blend.p1));
  const edge = 0.13;
  const lo = Math.max(0, center - edge), hi = Math.min(1, center + edge);
  const u = Math.max(0, Math.min(1, (t - lo) / Math.max(0.0001, hi - lo)));
  const f = u * u * (3 - 2 * u);
  return new THREE.Color(blend.color1).lerp(new THREE.Color(blend.color2), f);
}

export default function TamilNaduMap({ acs, districts, district, acNo, year, theme, onSelectDistrict, onSelectAc, onReset }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; title: string; sub: string; value: string; color: string } | null>(null);
  const live = useRef({ acs, districts, district, acNo, year, theme, onSelectDistrict, onSelectAc, onReset });
  live.current = { acs, districts, district, acNo, year, theme, onSelectDistrict, onSelectAc, onReset };
  const acByNo = useMemo(() => new Map(acs.map((a) => [a.no, a])), [acs]);
  const acRef = useRef(acByNo); acRef.current = acByNo;
  const districtByName = useMemo(() => new Map(districts.map((d) => [d.name, d])), [districts]);
  const districtRef = useRef(districtByName); districtRef.current = districtByName;
  const apiRef = useRef<{
    setSelection: (d: string | null, a: number | null, y: TnYearOrCurrent) => void;
    resetCamera: () => void;
  } | null>(null);

  useEffect(() => {
    const host = hostRef.current, canvas = canvasRef.current, labelRoot = labelRef.current;
    if (!host || !canvas || !labelRoot) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const P = PAL[theme];
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 1, 9000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x808898, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(-260, 620, 420); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xaebacc, 0.45);
    fill.position.set(420, 240, -520); scene.add(fill);
    const mapGroup = new THREE.Group(); scene.add(mapGroup);
    const projection = geoIdentity().reflectY(true).fitExtent([[70, 70], [BOX - 70, BOX - 70]], D_FC as never);
    const project = (p: [number, number]) => {
      const q = projection(p);
      return q ? ([q[0], q[1]] as [number, number]) : ([0, 0] as [number, number]);
    };

    type Anim = { start: number; dur: number; fromO: number; toO: number; fromL: number; toL: number; fromY: number; toY: number };
    type Unit = {
      group: THREE.Group; mesh: THREE.Mesh; cap: THREE.MeshStandardMaterial; side: THREE.MeshStandardMaterial;
      line?: THREE.LineBasicMaterial; bounds: { minx: number; maxx: number; minz: number; maxz: number };
      label: HTMLSpanElement; name: string; kind: "district" | "ac"; key: string; no?: number;
      opacity: number; lineOpacity: number; y: number; targetOpacity: number; targetLine: number; targetY: number; targetVisible: boolean;
      anim?: Anim;
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
      el.style.fontSize = kind === "district" ? "10px" : "8px"; el.style.zIndex = kind === "district" ? "4" : "3";
      el.style.color = P.label; el.style.textShadow = `0 0 3px ${P.halo}, 0 0 2px ${P.halo}`;
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
      const cap = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95, metalness: 0.03, side: THREE.DoubleSide, transparent: true, vertexColors: true });
      const side = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, metalness: 0.02, side: THREE.DoubleSide, transparent: true, vertexColors: true });
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
    const districtOutlineSeen = new Set<string>();
    const districtOutlinePoints: number[] = [];
    for (const f of D_FC.features) {
      const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
      for (const poly of polys) for (const ring of poly) {
        for (let i = 0; i < ring.length; i++) {
          const p = project([ring[i][0], ring[i][1]]); const q = project([ring[(i + 1) % ring.length][0], ring[(i + 1) % ring.length][1]]);
          const ax = p[0] - CX, az = p[1] - CZ, bx = q[0] - CX, bz = q[1] - CZ;
          const ka = `${ax.toFixed(3)},${az.toFixed(3)}`, kb = `${bx.toFixed(3)},${bz.toFixed(3)}`;
          const ek = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
          if (!districtOutlineSeen.has(ek)) { districtOutlineSeen.add(ek); districtOutlinePoints.push(ax, DEPTH + 0.12, az, bx, DEPTH + 0.12, bz); }
        }
      }
    }
    for (const f of D_FC.features) {
      const u = addFeature(f, "district");
      if (!u) continue;
      const districtKey = canonicalDistrict(f.properties.district);
      districtsUnits.set(districtKey, u);
      const layer = new THREE.Group(); layer.visible = false; u.group.add(layer); acLayer.set(districtKey, layer);
      mapGroup.add(u.group);
    }
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

    const boundaryGeo = new THREE.BufferGeometry();
    const boundaryMat = new THREE.LineBasicMaterial({ color: P.line, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    const boundaryLine = new THREE.LineSegments(boundaryGeo, boundaryMat); boundaryLine.renderOrder = 12; boundaryLine.frustumCulled = false; boundaryLine.visible = false; mapGroup.add(boundaryLine);
    const accentGeo = new THREE.BufferGeometry();
    const accentMat = new THREE.LineBasicMaterial({ color: P.sel, transparent: true, opacity: 1, depthTest: false, depthWrite: false });
    const accentLine = new THREE.LineSegments(accentGeo, accentMat); accentLine.renderOrder = 14; accentLine.frustumCulled = false; accentLine.visible = false; mapGroup.add(accentLine);
    const districtOutlineGeo = new THREE.BufferGeometry();
    districtOutlineGeo.setAttribute("position", new THREE.Float32BufferAttribute(districtOutlinePoints, 3));
    const districtOutlineMat = new THREE.LineBasicMaterial({ color: P.line, transparent: true, opacity: 0.82, depthTest: false, depthWrite: false });
    const districtOutline = new THREE.LineSegments(districtOutlineGeo, districtOutlineMat); districtOutline.renderOrder = 7; districtOutline.frustumCulled = false; mapGroup.add(districtOutline);
    const setPositions = (geo: THREE.BufferGeometry, pts: number[]) => {
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pts.length ? pts : [0, 0, 0, 0, 0, 0], 3));
      geo.computeBoundingSphere();
    };
    const showAccent = (no: number | null, selected = false) => {
      if (no == null || !acEdges.has(no)) { accentLine.visible = false; return; }
      setPositions(accentGeo, acEdges.get(no)!);
      accentMat.color.set(selected ? P.sel : P.hover);
      accentMat.opacity = selected ? 1 : 0.9;
      accentLine.position.y = (selected ? SELECTED_LIFT : AC_LIFT) - 2;
      accentLine.visible = true;
    };

    let cam = { tx: 0, tz: 0, ty: 0, dist: 2050, theta: 0, phi: 0.58 };
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
        const e = easeInOut(t);
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
        boundaryOpacity = lerp(boundaryFrom, boundaryTarget, easeInOut(t));
        if (t >= 1) boundaryStart = 0;
      }
      boundaryMat.opacity = boundaryOpacity;
      boundaryLine.visible = boundaryOpacity > 0.01;
      boundaryLine.position.y = boundaryOpacity > 0.01 ? AC_LIFT - 2 : 0;
      if (districtStart) {
        const t = reduced ? 1 : Math.max(0, Math.min(1, (now - districtStart) / ANIM_MS));
        districtOpacity = lerp(districtFrom, districtTarget, easeInOut(t));
        if (t >= 1) districtStart = 0;
      }
      districtOutlineMat.opacity = districtOpacity;
      districtOutline.visible = districtOpacity > 0.01;
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
      u.cap.needsUpdate = true; u.side.needsUpdate = true;
    };
    const tipValue = (b: BlendInfo) => {
      if (!b.first) return "No data";
      const first = `${TN_LABEL[b.first]} ${tnPct(b.firstShare)}`;
      const second = b.second ? ` · ${TN_LABEL[b.second]} ${tnPct(b.secondShare)}` : "";
      return `${first}${second} · lead ${b.marginPp == null ? "—" : b.marginPp.toFixed(1)} pp`;
    };

    apiRef.current = {
      setSelection: (d, a, y) => {
        const activeD = d ? districtsUnits.get(d) : null;
        const activeAC = a != null ? acUnits.get(a) : null;
        hoveredKey = null; hoveredNo = null; setTip(null); canvas.style.cursor = "grab";
        showAccent(activeAC?.no ?? null, !!activeAC);
        const mobileState = typeof window !== "undefined" && window.innerWidth < 640;
        const mobileLabels = new Set([...districtsUnits.keys()].sort((aKey, bKey) => (districtRef.current.get(bKey)?.survey.valid ?? 0) - (districtRef.current.get(aKey)?.survey.valid ?? 0)).slice(0, 10));
        for (const [name, u] of districtsUnits) {
          const selected = !!activeD && name === activeD.name;
          const acLayerGroup = acLayer.get(name); if (acLayerGroup) acLayerGroup.visible = !!activeD && selected;
          const blend = blendForDistrict(districtRef.current.get(canonicalDistrict(name)), y);
          applyGradient(u, blend);
          startUnit(u, activeD ? 0 : 1, activeD ? 0 : 0.9, 0, activeD ? selected : true);
          u.label.style.opacity = activeD ? (selected && !activeAC ? "1" : "0") : (mobileState && !mobileLabels.has(name) ? "0" : "1");
          u.label.style.fontSize = selected ? "12px" : "10px";
        }
        for (const [no, u] of acUnits) {
          const blend = blendForAc(acRef.current.get(no), y);
          const acSelected = !!activeAC && no === activeAC.no;
          const inSelectedDistrict = !!activeD && canonicalDistrict(u.mesh.userData.district) === activeD.name;
          const visible = !!activeD && (activeAC ? acSelected : inSelectedDistrict);
          applyGradient(u, blend);
          u.cap.emissive.set(acSelected && blend.first ? blend.color1 : "#000000");
          u.cap.emissiveIntensity = acSelected ? 0.32 : 0;
          startUnit(u, visible ? 1 : 0, 0, activeD ? (acSelected ? SELECTED_LIFT : AC_LIFT) : 0, visible);
          u.label.style.opacity = visible ? "1" : "0";
          u.label.style.fontSize = acSelected ? "10px" : "8px";
        }
        if (activeD && !activeAC && districtEdges.has(activeD.name)) setPositions(boundaryGeo, districtEdges.get(activeD.name)!);
        boundaryLine.visible = !!activeD && !activeAC;
        startBoundary(activeD && !activeAC ? 0.62 : 0);
        startDistrictOutline(activeD ? 0 : 0.82);
        // Camera framing: keep side panels clear; focus the selected scope.
        let bounds: { minx: number; maxx: number; minz: number; maxz: number } | null = null;
        if (activeAC) bounds = activeAC.bounds;
        else if (activeD) bounds = activeD.bounds;
        const hostRect = host.getBoundingClientRect();
        const vw = Math.max(320, hostRect.width), vh = Math.max(320, hostRect.height);
        const wide = typeof window !== "undefined" && window.innerWidth > 1024;
        let centerX = 0, centerZ = 0, dist = 2050;
        if (bounds) {
          centerX = (bounds.minx + bounds.maxx) / 2; centerZ = (bounds.minz + bounds.maxz) / 2;
          const W = Math.max(1, bounds.maxx - bounds.minx), H = Math.max(1, bounds.maxz - bounds.minz);
          const availW = Math.max(220, vw - (wide ? 680 : 0));
          const availH = Math.max(220, vh - 90);
          const fov = camera.fov * Math.PI / 180;
          const fit = Math.max((H / 2) / Math.tan(fov / 2), (W / 2) / Math.tan(Math.atan(Math.tan(fov / 2) * (availW / availH)))) * (activeAC ? 2.25 : 1.45);
          dist = Math.max(45, Math.min(3300, fit));
          const shift = wide ? -70 : 0;
          const worldPerPx = (2 * dist * Math.tan(fov / 2)) / availH;
          centerX += shift * worldPerPx;
        }
        startCamera({ tx: centerX, tz: centerZ, ty: activeAC ? 2.2 : activeD ? 0.8 : 0, dist, theta: 0, phi: 0.58 });
      },
      resetCamera: () => startCamera({ tx: 0, tz: 0, ty: 0, dist: 2050, theta: 0, phi: 0.58 }),
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
        const e = easeInOut(t);
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
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(host);
    const render = (now: number) => {
      updateCamera(now);
      for (const u of labelEls) updateUnit(u, now);
      updateBoundary(now);
      const rect = host.getBoundingClientRect();
      const boxes: { l: number; r: number; t: number; b: number }[] = [];
      const ordered = [...labelEls].sort((a, b) => {
        const pa = (a.kind === "ac" && a.no === live.current.acNo ? 100 : 0) + (a.kind === "ac" && a.no === hoveredNo ? 90 : 0) + (a.kind === "ac" ? 50 : a.name === live.current.district ? 40 : 10);
        const pb = (b.kind === "ac" && b.no === live.current.acNo ? 100 : 0) + (b.kind === "ac" && b.no === hoveredNo ? 90 : 0) + (b.kind === "ac" ? 50 : b.name === live.current.district ? 40 : 10);
        return pb - pa;
      });
      for (const u of ordered) {
        if (u.label.style.opacity === "0") { u.label.style.visibility = "hidden"; continue; }
        const x = Number(u.label.dataset.cx || 0), z = Number(u.label.dataset.cz || 0);
        const p = new THREE.Vector3(x, (u.kind === "district" ? DEPTH : DEPTH + AC_DEPTH) + u.y, z).project(camera);
        const sx = (p.x * 0.5 + 0.5) * rect.width, sy = (-p.y * 0.5 + 0.5) * rect.height;
        const size = parseFloat(u.label.style.fontSize || "9");
        const w = Math.max(18, (u.label.textContent?.length ?? 4) * size * 0.55 + 8), h = size + 5;
        const box = { l: sx - w / 2, r: sx + w / 2, t: sy - h / 2, b: sy + h / 2 };
        const collides = boxes.some((b) => box.l < b.r && box.r > b.l && box.t < b.b && box.b > b.t);
        if (collides && !(u.kind === "ac" && u.no === live.current.acNo)) { u.label.style.visibility = "hidden"; continue; }
        boxes.push(box); u.label.style.visibility = "visible";
        u.label.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-50%)`;
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
        if (hoveredKey) { hoveredKey = null; hoveredNo = null; restoreSelectedAccent(); }
        canvas.style.cursor = "grab"; setTip(null); return;
      }
      const data = hit.object.userData; const kind = data.kind as "district" | "ac";
      const key = kind === "district" ? "d:" + data.district : "a:" + data.no;
      if (key !== hoveredKey) {
        hoveredKey = key; hoveredNo = kind === "ac" ? data.no as number : null;
        canvas.style.cursor = "pointer";
        if (kind === "district") {
          showAccent(live.current.acNo, true);
          const blend = blendForDistrict(districtRef.current.get(canonicalDistrict(data.district)), live.current.year);
          setTip({ x: e.clientX, y: e.clientY, title: canonicalDistrict(data.district), sub: live.current.year === "2026" ? "2026 estimated vote share" : `${live.current.year} result`, value: tipValue(blend), color: blend.color });
        } else {
          showAccent(data.no as number, data.no === live.current.acNo);
          const a = acRef.current.get(data.no as number); const blend = blendForAc(a, live.current.year);
          setTip({ x: e.clientX, y: e.clientY, title: a?.name ?? `AC ${data.no}`, sub: `${canonicalDistrict(data.district)} · ${live.current.year === "2026" ? "estimated vote share" : live.current.year}`, value: tipValue(blend), color: blend.color });
        }
      } else setTip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : t);
    };
    const onPointerDown = (e: PointerEvent) => {
      pointers.add(e.pointerId);
      if (pointers.size > 1) { if (drag) drag.moved = true; return; }
      drag = { x: e.clientX, y: e.clientY, moved: false };
      canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing";
    };
    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      const wasDrag = drag?.moved; drag = null; canvas.style.cursor = "grab";
      if (wasDrag || pointers.size > 0) return;
      const hit = hitAt(e.clientX, e.clientY);
      if (!hit) { hoveredKey = null; hoveredNo = null; setTip(null); restoreSelectedAccent(); live.current.onReset(); return; }
      if (hit.object.userData.kind === "district") live.current.onSelectDistrict(canonicalDistrict(hit.object.userData.district as string));
      else live.current.onSelectAc(hit.object.userData.no as number);
    };
    const onPointerCancel = (e: PointerEvent) => { pointers.delete(e.pointerId); drag = null; canvas.style.cursor = "grab"; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = Math.max(35, Math.min(3300, camTarget.dist * (1 + e.deltaY * 0.0012)));
      startCamera({ ...camTarget, dist: next });
    };
    const onLeave = () => { hoveredKey = null; hoveredNo = null; setTip(null); restoreSelectedAccent(); drag = null; pointers.clear(); canvas.style.cursor = "grab"; };
    canvas.addEventListener("pointermove", onPointerMove); canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp); canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("pointerleave", onLeave); canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove); canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp); canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onLeave); canvas.removeEventListener("wheel", onWheel);
      labelRoot.innerHTML = ""; renderer.dispose();
    };
  }, [theme]);

  useEffect(() => {
    if (!ready) return;
    apiRef.current?.setSelection(district, acNo, year);
  }, [ready, district, acNo, year, acs, districts]);

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block h-full w-full touch-none" aria-label="3D map of Tamil Nadu districts and assembly constituencies" role="img" />
        <div ref={labelRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden />
      </div>
      {tip && <div className="pointer-events-none fixed z-[80] max-w-[240px] rounded-lg border border-border bg-card/95 px-2.5 py-2 text-[10px] shadow-xl backdrop-blur" style={{ left: Math.min(tip.x + 12, window.innerWidth - 255), top: Math.max(8, tip.y - 12) }}>
        <div className="font-semibold" style={{ color: tip.color }}>{tip.title}</div>
        <div className="text-[9px] text-muted-foreground">{tip.sub}</div>
        <div className="mt-0.5 tabular-nums text-foreground/85">{tip.value}</div>
      </div>}
      <div className="sr-only" aria-live="polite">{tip ? `${tip.title}: ${tip.value}` : ""}</div>
    </div>
  );
}
