"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { geoIdentity } from "d3-geo";
import { rafLoop } from "@/lib/raf-loop";
import { PARTY_META, type TgParty } from "@/lib/telangana/parties";
import { leadingParty, type AcRecord } from "@/lib/telangana/model";
import { brandMarker } from "@/lib/telangana/brands";
import { cn } from "@/lib/utils";

/* =====================================================================
   Telangana 3D assembly map.

   Deliberately mirrors the working Tamil Nadu map: same perspective camera
   (34° fov, theta 0, phi 0.6), same lighting rig, extrusion, boundary lines,
   elapsed-time easing (~700 ms camera/selection, ~300 ms hover/material),
   isolation-to-hidden behaviour, drag/pinch/wheel controls and camera fit
   that accounts for the floating panels.

   Geography: 119 sourced AC polygons + a dissolved outline for each of the
   33 uploaded analytical groupings (a dissolve of assemblies, NOT an
   official administrative boundary).
   ===================================================================== */

const BOX = 1000;
const DEPTH = 10;
const CX = BOX / 2;
const CZ = BOX / 2;
const CONTESTED = ["BRS", "INC", "BJP", "AIMIM", "TDP", "JSP", "Others"] as const;

export type MapTheme = "light" | "dark";

type AcFeature = {
  type: "Feature";
  properties: { acNo: number; name: string; group: string };
  geometry: { type: string; coordinates: unknown };
};
type DistrictFeature = {
  type: "Feature";
  properties: { group: string; acs: number[] };
  geometry: { type: "MultiPolygon"; coordinates: number[][][][] };
};
type FC<T> = { type: "FeatureCollection"; features: T[] };

export type TgMapProps = {
  acs: AcRecord[];
  theme: MapTheme;
  group: string | null;
  selectedAcs: number[];
  layer: "party" | "device";
  showLabels: boolean;
  onSelectGroup: (group: string) => void;
  onToggleAc: (ac: number, additive: boolean) => void;
  onHover: (ac: number | null, x: number, y: number) => void;
  resetNonce: number;
};

type Anchor = { x: number; z: number };
type MarkerDef = {
  key: string;
  level: "district" | "ac" | "brand";
  title: string;
  subtitle: string;
  brand: string;
  count: number;
  share: number;
  anchors: Anchor[];
  ac: number | null;
  group: string | null;
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const signedArea = (r: number[][]) => {
  let a = 0;
  for (let i = 0, n = r.length; i < n; i++) {
    const p = r[i], q = r[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
};

const PAL: Record<MapTheme, {
  none: THREE.Color; side: THREE.Color; line: THREE.Color; selLine: THREE.Color;
  districtLine: THREE.Color; label: string; halo: string;
}> = {
  dark: {
    none: new THREE.Color(0x2b3442), side: new THREE.Color(0x1c2531), line: new THREE.Color(0xa0adbc),
    selLine: new THREE.Color(0xffb866), districtLine: new THREE.Color(0xe6edf5),
    label: "#e8edf4", halo: "rgba(6,10,18,.85)",
  },
  light: {
    none: new THREE.Color(0xe7ebef), side: new THREE.Color(0xd3d9e0), line: new THREE.Color(0x9aa6b4),
    selLine: new THREE.Color(0xc2640c), districtLine: new THREE.Color(0x48525f),
    label: "#1b2430", halo: "rgba(255,255,255,.92)",
  },
};

/** Documented shared lightness scale: lead share 25%→45% density, 55%+→full. */
export function leadIntensity(sharePct: number | null): number {
  if (sharePct === null) return 0;
  return clamp(0.45 + ((sharePct - 25) / 30) * 0.55, 0.45, 1);
}

/* deterministic RNG for illustrative device anchors */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pointInRing(x: number, z: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], zi = ring[i][1], xj = ring[j][0], zj = ring[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function pointInPolygon(x: number, z: number, rings: number[][][]) {
  if (!rings.length || !pointInRing(x, z, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (pointInRing(x, z, rings[i])) return false;
  return true;
}

export default function TelanganaMap(props: TgMapProps) {
  const { acs, theme, group, selectedAcs, layer, showLabels, resetNonce } = props;

  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);

  const [geo, setGeo] = useState<FC<AcFeature> | null>(null);
  const [districtGeo, setDistrictGeo] = useState<FC<DistrictFeature> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const live = useRef<TgMapProps>(props);
  live.current = props;

  const acByNo = useMemo(() => new Map(acs.map((a) => [a.no, a])), [acs]);
  const acRef = useRef(acByNo);
  acRef.current = acByNo;

  /* ---------------- load geometry ---------------- */
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/telangana/telangana-ac.geojson").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      fetch("/telangana/telangana-districts.geojson").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
    ])
      .then(([a, d]: [FC<AcFeature>, FC<DistrictFeature>]) => {
        if (cancelled) return;
        setGeo(a); setDistrictGeo(d); setReady(true);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "geometry unavailable"); });
    return () => { cancelled = true; };
  }, []);

  /* ---------------- device markers (React-managed list) ---------------- */
  const [markers, setMarkers] = useState<MarkerDef[]>([]);
  const [tip, setTip] = useState<{ key: string; x: number; y: number } | null>(null);
  const suppressClickRef = useRef<string | null>(null);
  const anchorsRef = useRef<{ ac: Map<number, Anchor[]>; group: Map<string, Anchor> }>({ ac: new Map(), group: new Map() });

  const buildMarkers = (acAnchors: Map<number, Anchor[]>, groupAnchors: Map<string, Anchor>) => {
    if (layer !== "device" || !acAnchors.size) { setMarkers([]); return; }
    const list: MarkerDef[] = [];
    const acsWithData = acs.filter((a) => a.deviceTotal > 0 && acAnchors.has(a.no));

    if (selectedAcs.length) {
      for (const no of selectedAcs) {
        const rec = acByNo.get(no);
        const anchors = [...(acAnchors.get(no) ?? [])];
        if (!rec || !rec.deviceTotal || !anchors.length) continue;
        const brands = Object.entries(rec.device).sort((a, b) => b[1] - a[1]).slice(0, Math.min(8, anchors.length));
        // apportion the visible marks across brands by share (largest remainder)
        const n = Math.min(anchors.length, 8);
        const total = brands.reduce((s, [, c]) => s + c, 0) || 1;
        const exact = brands.map(([b, c]) => ({ b, c, q: (c / total) * n }));
        const counts = exact.map((e) => ({ ...e, k: Math.floor(e.q) }));
        let left = n - counts.reduce((s, e) => s + e.k, 0);
        counts.sort((a, b) => (b.q - Math.floor(b.q)) - (a.q - Math.floor(a.q)));
        for (let i = 0; i < counts.length && left > 0; i++, left--) counts[i].k++;
        let idx = 0;
        for (const e of counts) {
          for (let j = 0; j < e.k && idx < anchors.length; j++, idx++) {
            list.push({
              key: `brand-${no}-${e.b}-${idx}`, level: "brand", brand: e.b,
              title: rec.name, subtitle: `${e.b} · ${((e.c / rec.deviceTotal) * 100).toFixed(1)}% of this assembly's device metadata`,
              count: e.c, share: (e.c / rec.deviceTotal) * 100, anchors: [anchors[idx]],
              ac: no, group: rec.group,
            });
          }
        }
      }
    } else if (group) {
      for (const rec of acsWithData.filter((a) => a.group === group)) {
        const anchors = acAnchors.get(rec.no) ?? [];
        if (!anchors.length) continue;
        const [brand, count] = Object.entries(rec.device).sort((a, b) => b[1] - a[1])[0];
        list.push({
          key: `ac-${rec.no}`, level: "ac", brand, title: rec.name, subtitle: `${brand} · assembly device mix`,
          count, share: (count / rec.deviceTotal) * 100, anchors: [anchors[0]], ac: rec.no, group: rec.group,
        });
      }
    } else {
      const groups = new Map<string, AcRecord[]>();
      for (const a of acsWithData) {
        const arr = groups.get(a.group) ?? [];
        arr.push(a);
        groups.set(a.group, arr);
      }
      for (const [g, members] of groups) {
        const totals: Record<string, number> = {};
        let total = 0;
        for (const m of members) {
          for (const [b, n] of Object.entries(m.device)) totals[b] = (totals[b] ?? 0) + n;
          total += m.deviceTotal;
        }
        const [brand, count] = Object.entries(totals).sort((a, b) => b[1] - a[1])[0] ?? ["Unknown", 0];
        const anchor = groupAnchors.get(g);
        if (!anchor || !total) continue;
        list.push({
          key: `g-${g}`, level: "district", brand, title: g, subtitle: `${brand} · district device mix`,
          count, share: (count / total) * 100, anchors: [anchor], ac: null, group: g,
        });
      }
    }
    setMarkers(list);
  };
  const buildMarkersRef = useRef(buildMarkers);
  buildMarkersRef.current = buildMarkers;
  const markerDefsRef = useRef(new Map<string, MarkerDef>());

  /* ---------------- scene ---------------- */
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!geo || !districtGeo || !host || !canvas) return;

    const P = PAL[theme];
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 1, 9000);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x808898, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(-260, 620, 420);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xaebacc, 0.45);
    fill.position.set(420, 240, -520);
    scene.add(fill);

    const projection = geoIdentity().reflectY(true).fitExtent([[70, 70], [BOX - 70, BOX - 70]], geo as never);
    const project = (lng: number, lat: number): [number, number] => {
      const p = projection([lng, lat]);
      return p ? [p[0] - CX, p[1] - CZ] : [0, 0];
    };

    type Entry = {
      no: number; group: string;
      group3: THREE.Group;
      cap: THREE.MeshStandardMaterial;
      side: THREE.MeshStandardMaterial;
      line: THREE.LineBasicMaterial;
      mesh: THREE.Mesh;
      heat: number; hover: number; isolate: number; focus: number; elev: number;
      bounds: { minx: number; maxx: number; minz: number; maxz: number };
      cx: number; cz: number;
    };
    const entries = new Map<number, Entry>();
    const byGroup = new Map<string, number[]>();
    const pickables: THREE.Mesh[] = [];

    for (const f of geo.features) {
      const rings = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
      const shapes: THREE.Shape[] = [];
      for (const poly of rings) {
        const toVec = (ring: number[][]) => ring.map(([lng, lat]) => { const [x, z] = project(lng, lat); return new THREE.Vector2(x, z); });
        const outer = toVec(poly[0]);
        if (outer.length < 3) continue;
        if (signedArea(poly[0]) < 0) outer.reverse();
        const shape = new THREE.Shape(outer);
        for (let h = 1; h < poly.length; h++) {
          const hole = toVec(poly[h]);
          if (hole.length < 3) continue;
          if (signedArea(poly[h]) > 0) hole.reverse();
          shape.holes.push(new THREE.Path(hole));
        }
        shapes.push(shape);
      }
      if (!shapes.length) continue;

      const geom = new THREE.ExtrudeGeometry(shapes, { depth: DEPTH, bevelEnabled: false, curveSegments: 1 });
      geom.rotateX(Math.PI / 2);
      geom.translate(0, DEPTH, 0);

      const cap = new THREE.MeshStandardMaterial({ color: P.none.clone(), roughness: 0.95, metalness: 0.03, side: THREE.DoubleSide, transparent: true, opacity: 1 });
      const side = new THREE.MeshStandardMaterial({ color: P.side.clone(), roughness: 1, metalness: 0.02, side: THREE.DoubleSide, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(geom, [cap, side]);
      mesh.userData.acNo = f.properties.acNo;
      pickables.push(mesh);

      const group3 = new THREE.Group();
      group3.add(mesh);

      // assembly boundary, attached to the top surface
      const pts: number[] = [];
      let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
      for (const poly of rings) for (const ring of poly) {
        for (let i = 0; i < ring.length; i++) {
          const [px, pz] = project(ring[i][0], ring[i][1]);
          const [qx, qz] = project(ring[(i + 1) % ring.length][0], ring[(i + 1) % ring.length][1]);
          minx = Math.min(minx, px); maxx = Math.max(maxx, px);
          minz = Math.min(minz, pz); maxz = Math.max(maxz, pz);
          pts.push(px, DEPTH + 0.06, pz, qx, DEPTH + 0.06, qz);
        }
      }
      const lineGeom = new THREE.BufferGeometry();
      lineGeom.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const line = new THREE.LineBasicMaterial({ color: P.line.clone(), transparent: true, opacity: 0.55 });
      group3.add(new THREE.LineSegments(lineGeom, line));
      scene.add(group3);

      entries.set(f.properties.acNo, {
        no: f.properties.acNo, group: f.properties.group, group3, cap, side, line, mesh,
        heat: 0, hover: 0, isolate: 0, focus: 1, elev: 0,
        bounds: { minx, maxx, minz, maxz }, cx: (minx + maxx) / 2, cz: (minz + maxz) / 2,
      });
      const arr = byGroup.get(f.properties.group) ?? [];
      arr.push(f.properties.acNo);
      byGroup.set(f.properties.group, arr);
    }

    // district outlines (dissolved analytical groupings)
    const districtLines = new Map<string, { line: THREE.LineBasicMaterial; obj: THREE.LineSegments }>();
    for (const f of districtGeo.features) {
      const pts: number[] = [];
      for (const poly of f.geometry.coordinates) for (const ring of poly) {
        for (let i = 0; i < ring.length; i++) {
          const [px, pz] = project(ring[i][0], ring[i][1]);
          const [qx, qz] = project(ring[(i + 1) % ring.length][0], ring[(i + 1) % ring.length][1]);
          pts.push(px, DEPTH + 0.12, pz, qx, DEPTH + 0.12, qz);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const mat = new THREE.LineBasicMaterial({ color: P.districtLine.clone(), transparent: true, opacity: 0.6 });
      const obj = new THREE.LineSegments(g, mat);
      scene.add(obj);
      districtLines.set(f.properties.group, { line: mat, obj });
    }

    /* --- deterministic illustrative anchors inside each assembly --- */
    const acAnchors = new Map<number, Anchor[]>();
    const groupAnchors = new Map<string, Anchor>();
    const centroids = new Map<string, { x: number; z: number; w: number }>();
    for (const f of geo.features) {
      const rings = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
      const outer = rings[0]?.[0] ?? [];
      if (outer.length < 4) continue;
      const projected = outer.map(([lng, lat]) => project(lng, lat));
      const b = { minx: Infinity, maxx: -Infinity, minz: Infinity, maxz: -Infinity };
      for (const [x, z] of projected) { b.minx = Math.min(b.minx, x); b.maxx = Math.max(b.maxx, x); b.minz = Math.min(b.minz, z); b.maxz = Math.max(b.maxz, z); }
      const holes = rings[0].slice(1).map((ring) => ring.map(([lng, lat]) => project(lng, lat)));
      const ringsProj = [projected, ...holes];
      const w = b.maxx - b.minx, h = b.maxz - b.minz;
      const cx = (b.minx + b.maxx) / 2, cz = (b.minz + b.maxz) / 2;
      const rnd = mulberry32(f.properties.acNo * 7919 + 17);
      const area = w * h;
      const want = clamp(Math.round(Math.sqrt(area) / 3.2), 2, 12);
      const minGap = Math.max(2.4, Math.min(9, Math.sqrt(area) * 0.3));
      const chosen: Anchor[] = [];
      for (let attempt = 0; attempt < want * 90 && chosen.length < want; attempt++) {
        const x = b.minx + rnd() * w, z = b.minz + rnd() * h;
        if (!pointInPolygon(x, z, ringsProj)) continue;
        if (chosen.some((c) => Math.hypot(c.x - x, c.z - z) < minGap)) continue;
        chosen.push({ x, z });
      }
      // prefer anchors closer to the centroid so markers stay visually central
      chosen.sort((a, c) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(c.x - cx, c.z - cz));
      if (chosen.length) acAnchors.set(f.properties.acNo, chosen);
      const gc = centroids.get(f.properties.group) ?? { x: 0, z: 0, w: 0 };
      gc.x += cx; gc.z += cz; gc.w += 1;
      centroids.set(f.properties.group, gc);
    }
    for (const [g, c] of centroids) if (c.w) groupAnchors.set(g, { x: c.x / c.w, z: c.z / c.w });
    anchorsRef.current = { ac: acAnchors, group: groupAnchors };
    buildMarkersRef.current(acAnchors, groupAnchors);

    /* ---------------- camera ---------------- */
    let theta = 0, phi = 0.6, dist = 2020;
    const target = new THREE.Vector3(0, 0, 0);
    const desired = { tx: 0, tz: 0, dist: 2020 };
    const applyCamera = () => {
      camera.position.set(
        target.x + dist * Math.sin(phi) * Math.sin(theta),
        dist * Math.cos(phi),
        target.z + dist * Math.sin(phi) * Math.cos(theta),
      );
      camera.lookAt(target);
    };

    const panelOffsets = () => {
      const wide = typeof window !== "undefined" && window.innerWidth > 1024;
      return wide ? { leftPx: 330, rightPx: 330 } : { leftPx: 0, rightPx: 0 };
    };

    const fitTo = (nos: number[] | null, opts: { margin?: number; min?: number } = {}) => {
      const { margin = 1.35, min = 90 } = opts;
      const rect = host.getBoundingClientRect();
      const vw = Math.max(320, rect.width), vh = Math.max(320, rect.height);
      const { leftPx, rightPx } = panelOffsets();
      let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
      const use = nos && nos.length ? nos : null;
      for (const e of entries.values()) {
        if (use && !use.includes(e.no)) continue;
        minx = Math.min(minx, e.bounds.minx); maxx = Math.max(maxx, e.bounds.maxx);
        minz = Math.min(minz, e.bounds.minz); maxz = Math.max(maxz, e.bounds.maxz);
      }
      if (!isFinite(minx)) return;
      const cx = (minx + maxx) / 2, cz = (minz + maxz) / 2;
      const W = Math.max(20, maxx - minx), H = Math.max(20, maxz - minz);
      const availW = Math.max(220, vw - leftPx - rightPx);
      const availH = Math.max(220, vh - 130);
      const aspect = availW / availH;
      const fov = (camera.fov * Math.PI) / 180;
      const horizHalf = Math.atan(Math.tan(fov / 2) * aspect);
      const distH = (H / 2) / Math.tan(fov / 2);
      const distW = (W / 2) / Math.tan(horizHalf);
      const fit = clamp(Math.max(distH, distW) * margin, min, 3200);
      const shiftPx = (leftPx - rightPx) / 2;
      const worldPerPx = (2 * fit * Math.tan(fov / 2)) / availH;
      desired.tx = cx - shiftPx * worldPerPx;
      desired.tz = cz;
      desired.dist = fit;
    };

    /* ---------------- pointer ---------------- */
    const pointers = new Map<number, { x: number; y: number }>();
    let dragging = false, dragMoved = false, lastX = 0, lastY = 0, pinchDist = 0;
    const mouse = { px: -1, py: -1 };
    let hovered: number | null = null;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const localPoint = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; };

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, localPoint(e));
      if (pointers.size === 1) { dragging = true; dragMoved = false; lastX = e.clientX; lastY = e.clientY; }
      else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchDist = Math.hypot(a.x - b.x, a.y - b.y); }
    };
    const onPointerMove = (e: PointerEvent) => {
      const lp = localPoint(e);
      mouse.px = e.clientX; mouse.py = e.clientY;
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, lp);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) { dist = clamp(dist * (pinchDist / d), 200, 3200); desired.dist = dist; }
        pinchDist = d; return;
      }
      if (dragging) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
        theta = clamp(theta - dx * 0.005, -0.6, 0.6);
        phi = clamp(phi - dy * 0.004, 0.15, 1.2);
        desired.tx = target.x; desired.tz = target.z; desired.dist = dist;
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (pointers.size === 0) {
        const wasDrag = dragMoved; dragging = false; dragMoved = false;
        if (!wasDrag) {
          if (hovered != null) {
            if (!live.current.group) {
              const g = entries.get(hovered)?.group;
              if (g) live.current.onSelectGroup(g);
            } else {
              live.current.onToggleAc(hovered, e.shiftKey || e.metaKey || e.ctrlKey);
            }
          }
        }
      }
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); dist = clamp(dist * (1 + e.deltaY * 0.0012), 200, 3200); desired.dist = dist; };
    const onLeave = () => { mouse.px = -1; mouse.py = -1; hovered = null; live.current.onHover(null, 0, 0); };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    let w = 1, h = 1;
    const resize = () => {
      const r = host.getBoundingClientRect();
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    /* ---------------- frame ---------------- */
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const TAU_CAM = 220, TAU_HEAT = 220, TAU_HOVER = 95, TAU_MAT = 85;
    let lastFrame = performance.now();
    let lastSig = "";
    let markerReveal = 0;
    const labelV = new THREE.Vector3();

    const frame = () => {
      const now = performance.now();
      const dt = Math.min(50, Math.max(1, now - lastFrame));
      lastFrame = now;

      const sel = live.current.selectedAcs;
      const grp = live.current.group;
      const sig = `${grp ?? ""}|${sel.join(",")}|${live.current.resetNonce}`;
      if (sig !== lastSig) {
        lastSig = sig;
        fitTo(
          sel.length ? sel : grp ? byGroup.get(grp) ?? null : null,
          sel.length ? { margin: 1.7, min: 120 } : undefined,
        );
      }

      const aCam = reduced ? 1 : 1 - Math.exp(-dt / TAU_CAM);
      target.x += (desired.tx - target.x) * aCam;
      target.z += (desired.tz - target.z) * aCam;
      dist += (desired.dist - dist) * aCam;
      applyCamera();

      const selSet = sel.length ? new Set(sel) : null;
      const grpSet = grp ? new Set(byGroup.get(grp) ?? []) : null;
      // Isolation is at district level; selecting assemblies keeps the district
      // (and its neighbours) for context, like the Tamil Nadu focus behaviour.
      const isolateSet = grpSet ?? selSet;
      const settled = Math.abs(desired.dist - dist) < desired.dist * 0.035
        && Math.abs(desired.tx - target.x) < 40 && Math.abs(desired.tz - target.z) < 40;

      // hover raycast
      let found: number | null = null;
      if (mouse.px >= 0) {
        const r = canvas.getBoundingClientRect();
        ndc.set(((mouse.px - r.left) / r.width) * 2 - 1, -(((mouse.py - r.top) / r.height) * 2 - 1));
        ray.setFromCamera(ndc, camera);
        const allowed = isolateSet ? pickables.filter((m) => isolateSet.has(m.userData.acNo as number)) : pickables;
        const hit = ray.intersectObjects(allowed, false)[0];
        found = hit ? (hit.object.userData.acNo as number) : null;
      }
      if (found !== hovered) {
        hovered = found;
        live.current.onHover(found, mouse.px, mouse.py);
        canvas.style.cursor = found != null ? "pointer" : dragging ? "grabbing" : "grab";
      }

      const aHeat = reduced ? 1 : 1 - Math.exp(-dt / TAU_HEAT);
      const aHover = reduced ? 1 : 1 - Math.exp(-dt / TAU_HOVER);
      const aMat = reduced ? 1 : 1 - Math.exp(-dt / TAU_MAT);

      for (const e of entries.values()) {
        const rec = acRef.current.get(e.no);
        const inScope = !isolateSet || isolateSet.has(e.no);
        const isSel = !!selSet && selSet.has(e.no);
        const isHover = hovered === e.no;
        e.heat += ((isSel ? 1 : 0) - e.heat) * aHeat;
        e.hover += ((isHover ? 1 : 0) - e.hover) * aHover;
        e.isolate += ((inScope ? 0 : 1) - e.isolate) * aMat;
        const dim = selSet && !isSel ? 0.45 : 1;
        e.focus += ((isolateSet ? (inScope ? dim : 0) : 1) - e.focus) * aHeat;
        const targetElev = isolateSet ? (inScope ? 6 : 0) : 0;
        e.elev += (targetElev - e.elev) * aHeat;

        const vis = 1 - e.isolate;
        const lead = leadingParty(rec?.a2028 ?? {}, CONTESTED as unknown as string[]);
        const has = (rec?.answered2028 ?? 0) > 0 && !!lead.party;
        const base = has ? new THREE.Color(PARTY_META[lead.party as TgParty].color) : P.none.clone();
        if (has) base.lerp(new THREE.Color(live.current.theme === "dark" ? "#0b1016" : "#ffffff"), 1 - leadIntensity(lead.share));
        base.multiplyScalar(0.62 + 0.38 * e.focus);
        const targetCol = base
          .lerp(new THREE.Color(live.current.theme === "dark" ? 0x3c4a5d : 0xd9dee5), e.hover * (1 - e.heat) * 0.85)
          .lerp(new THREE.Color(live.current.theme === "dark" ? 0xffb866 : 0xf7c894), e.heat * 0.55);
        e.cap.color.lerp(targetCol, aMat);
        e.cap.opacity = vis;
        e.side.color.lerp(P.side, aMat);
        e.side.opacity = vis * (0.7 + 0.3 * e.focus);
        e.line.color.copy(P.line).lerp(P.selLine, e.heat);
        e.line.opacity = (live.current.layer === "party" ? 0.55 : 0.3) * vis;
        e.group3.visible = vis > 0.01;
        e.group3.position.y = e.elev + (isSel ? 2 : 0) + e.hover * 1.5;
      }

      // district outlines: strong at state level, subtle once focused
      for (const [g, d] of districtLines) {
        const inScope = !grp || g === grp;
        d.obj.visible = inScope;
        d.obj.position.y = grp && g === grp ? 6 : 0;
        d.line.opacity = grp ? (g === grp ? 0.85 : 0) : 0.55;
        d.line.color.copy(P.districtLine);
      }

      /* ---- labels (DOM, positioned per frame) ---- */
      const hostRect = host.getBoundingClientRect();
      const toScreen = (x: number, y: number, z: number) => {
        labelV.set(x, y, z).project(camera);
        return { x: (labelV.x * 0.5 + 0.5) * hostRect.width, y: (-labelV.y * 0.5 + 0.5) * hostRect.height, behind: labelV.z > 1 };
      };
      const labels = labelRef.current?.querySelectorAll<HTMLElement>("[data-label]");
      if (labels && labels.length) {
        const placed: { x: number; y: number; w: number; h: number }[] = [];
        labels.forEach((el) => {
          const noRaw = el.dataset.label ?? "";
          const gname = el.dataset.group || null;
          const no = noRaw ? Number(noRaw) : null;
          let px = 0, pz = 0, elev = 0, inScope = true, behind = false;
          if (no != null) {
            const e = entries.get(no);
            if (!e) { el.style.display = "none"; return; }
            const p = toScreen(e.cx, DEPTH + 0.2 + e.group3.position.y, e.cz);
            px = p.x; pz = p.y; elev = e.focus; behind = p.behind;
            inScope = !isolateSet || isolateSet.has(no);
          } else if (gname) {
            const a = groupAnchors.get(gname);
            if (!a) { el.style.display = "none"; return; }
            const p = toScreen(a.x, DEPTH + 0.2, a.z);
            px = p.x; pz = p.y; elev = 1; behind = p.behind;
            inScope = !grp || grp === gname;
          } else { el.style.display = "none"; return; }
          if (!inScope || behind || px < 6 || px > hostRect.width - 6 || pz < 6 || pz > hostRect.height - 6) { el.style.display = "none"; return; }
          const text = el.textContent ?? "";
          const lw = Math.max(34, text.length * 5.2), lh = 12;
          if (placed.some((b) => Math.abs(b.x - px) < (b.w + lw) / 2 && Math.abs(b.y - pz) < (b.h + lh) / 2)) { el.style.display = "none"; return; }
          placed.push({ x: px, y: pz, w: lw, h: lh });
          el.style.display = "";
          el.style.transform = `translate(-50%,-50%) translate(${px.toFixed(1)}px, ${pz.toFixed(1)}px)`;
          el.style.opacity = (0.55 + 0.45 * elev).toFixed(2);
        });
      }

      /* ---- device markers (DOM, follow the elevated transform) ---- */
      markerReveal += ((settled ? 1 : 0) - markerReveal) * (reduced ? 1 : 1 - Math.exp(-dt / 140));
      const mEls = markerRef.current?.querySelectorAll<HTMLElement>("[data-marker]");
      if (mEls) {
        mEls.forEach((el) => {
          const key = el.dataset.marker!;
          const def = markerDefsRef.current.get(key);
          if (!def) { el.style.display = "none"; return; }
          const anchor = def.anchors[0];
          const elev = def.ac != null ? entries.get(def.ac)?.group3.position.y ?? 0 : 0;
          const p = toScreen(anchor.x, DEPTH + 0.6 + elev, anchor.z);
          const inScope = def.ac != null
            ? (!isolateSet || isolateSet.has(def.ac))
            : (!grp || grp === def.group);
          if (!inScope || p.behind || markerReveal < 0.03) { el.style.display = "none"; return; }
          el.style.display = "";
          el.style.opacity = Math.min(1, markerReveal).toFixed(2);
          el.style.pointerEvents = markerReveal > 0.5 ? "auto" : "none";
          el.style.transform = `translate(-50%,-50%) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
          el.style.zIndex = String(Math.round(20 + (def.level === "brand" ? 4 : def.level === "ac" ? 2 : 0)));
        });
      }

      renderer.render(scene, camera);
    };

    const loop = rafLoop(frame);
    applyCamera();
    frame();

    return () => {
      loop();
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
      for (const e of entries.values()) {
        e.mesh.geometry.dispose();
        e.cap.dispose();
        e.side.dispose();
        e.line.dispose();
      }
      for (const d of districtLines.values()) { d.obj.geometry.dispose(); d.line.dispose(); }
      renderer.dispose();
    };
  }, [geo, districtGeo, theme]);

  /* keep markers in sync with scope/layer */
  useEffect(() => {
    if (anchorsRef.current.ac.size) buildMarkersRef.current(anchorsRef.current.ac, anchorsRef.current.group);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, selectedAcs, layer, acs]);

  markerDefsRef.current = new Map(markers.map((m) => [m.key, m]));

  /* labels for the current scope */
  const labelList = useMemo<{ key: string; text: string; ac?: number; group?: string }[]>(() => {
    if (!showLabels || !geo) return [];
    if (group) {
      return geo.features
        .filter((f) => f.properties.group === group)
        .map((f) => ({ key: `ac-${f.properties.acNo}`, text: f.properties.name, ac: f.properties.acNo }));
    }
    const groups = new Map<string, string>();
    for (const f of geo.features) groups.set(f.properties.group, f.properties.group);
    return [...groups.values()].map((g) => ({ key: `g-${g}`, text: g, group: g }));
  }, [geo, group, showLabels]);

  /* one quiet tooltip: pointer/focus opens it, Escape or a tap elsewhere closes it */
  useEffect(() => {
    if (!tip) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setTip(null); };
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement)?.closest?.("[data-device-marker]")) setTip(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [tip]);
  const tipDef = tip ? markerDefsRef.current.get(tip.key) : null;

  const openTip = (m: MarkerDef, el: HTMLElement) => {
    const host = hostRef.current;
    if (!host) return;
    const hb = host.getBoundingClientRect();
    const rb = el.getBoundingClientRect();
    setTip({
      key: m.key,
      x: clamp(rb.left - hb.left + rb.width / 2, 112, Math.max(112, hb.width - 112)),
      y: Math.max(6, rb.top - hb.top - 8),
    });
  };

  return (
    <div ref={hostRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" aria-label="Telangana assembly map" role="img" />

      {!ready && !error && <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">Loading Telangana geometry…</div>}
      {error && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">Map geometry could not be loaded ({error}).</div>}

      <div ref={labelRef} className="pointer-events-none absolute inset-0">
        {labelList.map((l) => (
          <span key={l.key} data-label={l.ac != null ? String(l.ac) : ""} data-group={l.group ?? ""} className="absolute left-0 top-0 whitespace-nowrap rounded px-1 text-[9.5px] font-semibold leading-none" style={{ color: PAL[theme].label, background: PAL[theme].halo, display: "none" }}>
            {l.text}
          </span>
        ))}
      </div>

      <div ref={markerRef} className="pointer-events-none absolute inset-0">
        {markers.map((m) => (
          <button
            key={m.key}
            type="button"
            data-marker={m.key}
            onClick={(e) => {
              if (suppressClickRef.current === m.key) { suppressClickRef.current = null; return; }
              if (m.ac != null) props.onToggleAc(m.ac, e.shiftKey || e.metaKey || e.ctrlKey);
              else if (m.group) props.onSelectGroup(m.group);
            }}
            title={`${m.title} · ${m.brand} · ${m.share.toFixed(1)}% of aggregate device metadata`}
            aria-label={`${m.title}: ${m.brand}, ${m.share.toFixed(2)} percent of aggregate device metadata. Illustrative placement, not a handset location.`}
            data-device-marker
            onPointerEnter={(e) => openTip(m, e.currentTarget)}
            onPointerLeave={() => setTip(null)}
            onPointerDown={(e) => {
              if (e.pointerType !== "touch") return;
              if (tip?.key !== m.key) {
                // first tap shows the compact detail; a second tap selects
                suppressClickRef.current = m.key;
                openTip(m, e.currentTarget);
              }
            }}
            onFocus={(e) => openTip(m, e.currentTarget)}
            onBlur={() => setTip(null)}
            onKeyDown={(e) => { if (e.key === "Escape") setTip(null); }}
            className={cn(
              "pointer-events-auto absolute left-0 top-0 grid place-items-center rounded-full border border-border bg-white shadow-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron",
              m.level === "brand" ? "size-8" : "size-9",
            )}
            style={{ display: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brandMarker(m.brand).src} alt="" className="h-5 w-7 object-contain" draggable={false} />
          </button>
        ))}
      </div>

      {tip && tipDef && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-30 w-max max-w-[210px] -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-card/95 px-2.5 py-1.5 text-left shadow-lg backdrop-blur transition-opacity duration-150"
          style={{ left: tip.x, top: tip.y }}
        >
          <p className="text-[11.5px] font-semibold leading-tight">{tipDef.brand}</p>
          <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{tipDef.group ? `${tipDef.group} · ${tipDef.title}` : tipDef.title}</p>
          <p className="mt-0.5 text-[10px] tabular-nums leading-tight">Device mix: {tipDef.share.toFixed(2)}%</p>
        </div>
      )}

      <div className="pointer-events-none absolute right-3 top-3 rounded-lg border border-border bg-card/85 px-2 py-1 text-[9.5px] text-muted-foreground backdrop-blur">
        {layer === "device" ? "Device mix · illustrative placement" : "Leading 2028 survey party"}
      </div>
    </div>
  );
}
