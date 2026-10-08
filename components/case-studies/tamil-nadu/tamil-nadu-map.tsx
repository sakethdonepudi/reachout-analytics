"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { geoIdentity } from "d3-geo";
import { rafLoop } from "@/lib/raf-loop";
import TN_GEO from "@/lib/data/tamil-nadu-districts.json";
import INDIA_GEO from "@/lib/data/india-geo.json";
import {
  districtCentroid,
  districtRadius,
  type DistrictPollResult,
  type PartyResult,
  type PollType,
} from "@/lib/data/tamil-nadu-poll-data";
import MapTooltip, { type MapTooltipData } from "./map-tooltip";

/* =====================================================================
   Interactive 2.5D Tamil Nadu district map — Tamil Nadu only.
   No surrounding states, no neighbouring labels, no grid, no glow.
   Boundary data: lib/data/tamil-nadu-districts.json (see that module).
   ===================================================================== */

type GeoFeature = { type: "Feature"; properties: { district: string }; geometry: { type: string; coordinates: unknown } };
const FC = TN_GEO as unknown as { type: "FeatureCollection"; features: GeoFeature[] };
const INDIA = INDIA_GEO as unknown as { id: string; rings: number[][][] }[];

const BOX = 1000;
const CX = BOX / 2;
const CZ = BOX / 2;
const CLUSTER_DIST = 1250;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const signedArea = (r: number[][]) => {
  let a = 0;
  for (let i = 0, n = r.length; i < n; i++) {
    const p = r[i], q = r[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
};

export type MapMode = "state" | "district" | "pincode";
export type MapLayers = { boundaries: boolean; pins: boolean; labels: boolean; context: boolean };
type ThemeName = "light" | "dark";

/* Theme-aware cartographic palette (see globals.css tokens). */
const PAL: Record<ThemeName, {
  fill: THREE.Color; hover: THREE.Color; sel: THREE.Color; selLine: THREE.Color;
  line: THREE.Color; state: THREE.Color; side: THREE.Color; label: string; halo: string;
}> = {
  dark: {
    fill: new THREE.Color(0x2b3746), hover: new THREE.Color(0x3c4a5d), sel: new THREE.Color(0xc2591a), selLine: new THREE.Color(0xf58a24),
    line: new THREE.Color(0xa0adbc), state: new THREE.Color(0xd5dce5), side: new THREE.Color(0x1c2531),
    label: "#e7ecf2", halo: "rgba(0,0,0,.82)",
  },
  light: {
    fill: new THREE.Color(0xe7ebef), hover: new THREE.Color(0xd9dee5), sel: new THREE.Color(0xf7c894), selLine: new THREE.Color(0xe07617),
    line: new THREE.Color(0x9aa6b4), state: new THREE.Color(0x48525f), side: new THREE.Color(0xd3d9e0),
    label: "#20242b", halo: "rgba(255,255,255,.92)",
  },
};

type Props = {
  pollType: PollType;
  districts: DistrictPollResult[];
  selectedDistricts: string[];
  activeDistrict: string | null;
  hoveredDistrict: string | null;
  activePincode: string | null;
  mode: MapMode;
  layers: MapLayers;
  theme: ThemeName;
  resetNonce?: number;
  onHoverDistrict: (name: string | null) => void;
  onSelectDistrict: (name: string | null) => void;
  onSelectPincode: (pincode: string | null) => void;
};

type DistrictState = {
  id: string;
  name: string;
  mesh: THREE.Mesh;
  cap: THREE.MeshStandardMaterial;
  line: THREE.LineBasicMaterial;
  group: THREE.Group;
  tone: number;
  heat: number;
  hover: number;
};

export default function TamilNaduMap(props: Props) {
  const {
    pollType, districts: pollData, selectedDistricts, activeDistrict, hoveredDistrict, activePincode,
    mode, layers, theme, resetNonce, onHoverDistrict, onSelectDistrict, onSelectPincode,
  } = props;

  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<{ x: number; y: number } | null>(null);
  const [tip, setTip] = useState<MapTooltipData | null>(null);
  const [ready, setReady] = useState(false);

  const live = useRef({ pollType, districts: pollData, selectedDistricts, activeDistrict, hoveredDistrict, activePincode, mode, layers, theme, onHoverDistrict, onSelectDistrict, onSelectPincode });
  live.current = { pollType, districts: pollData, selectedDistricts, activeDistrict, hoveredDistrict, activePincode, mode, layers, theme, onHoverDistrict, onSelectDistrict, onSelectPincode };

  const apiRef = useRef<{ rebuildPins: () => void; setSelection: (selected: string[]) => void; reset: () => void } | null>(null);

  // Planar identity projection (boundary rings are clockwise-wound, so a
  // spherical projection would read Tamil Nadu as the complement of the globe).
  const projection = useMemo(
    () => geoIdentity().reflectY(true).fitExtent([[70, 70], [BOX - 70, BOX - 70]], FC as never),
    [],
  );
  const projectLngLat = useCallback(
    (lng: number, lat: number): [number, number] => {
      const p = projection([lng, lat]);
      return p ? [p[0] - CX, p[1] - CZ] : [0, 0];
    },
    [projection],
  );

  useEffect(() => {
    const host = hostRef.current!;
    const canvas = canvasRef.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setClearAlpha(0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 1, 9000);

    // neutral, restrained lighting for flat slate fills
    scene.add(new THREE.HemisphereLight(0xffffff, 0x808898, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(-260, 620, 420);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xaebacc, 0.45);
    fill.position.set(420, 240, -520);
    scene.add(fill);

    const mapGroup = new THREE.Group();
    scene.add(mapGroup);

    const states: Record<string, DistrictState> = {};
    const pickables: THREE.Mesh[] = [];

    for (const f of FC.features) {
      const name = f.properties.district;
      const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
      const shapes: THREE.Shape[] = [];
      for (const poly of polys) {
        const toVec = (ring: number[][]) => ring.map(([lng, lat]) => { const p = projection([lng, lat])!; return new THREE.Vector2(p[0] - CX, p[1] - CZ); });
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
      if (shapes.length === 0) continue;

      const geo = new THREE.ShapeGeometry(shapes, 1);
      geo.rotateX(Math.PI / 2);

      const cap = new THREE.MeshStandardMaterial({ color: PAL.dark.fill.clone(), roughness: 0.95, metalness: 0.03, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, cap);
      mesh.userData.id = name;
      pickables.push(mesh);

      // crisp district boundary line on the flat surface
      const pts: number[] = [];
      const y = 0.06;
      const addLoop = (ring: number[][]) => {
        for (let i = 0; i < ring.length; i++) {
          const p = projection(ring[i] as [number, number])!;
          const q = projection(ring[(i + 1) % ring.length] as [number, number])!;
          pts.push(p[0] - CX, y, p[1] - CZ, q[0] - CX, y, q[1] - CZ);
        }
      };
      for (const poly of polys) poly.forEach(addLoop);
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const line = new THREE.LineBasicMaterial({ color: PAL.dark.line.clone(), transparent: true, opacity: 1 });
      mapGroup.add(new THREE.LineSegments(lg, line));

      const g = new THREE.Group();
      g.add(mesh);
      mapGroup.add(g);
      const tone = 0.96 + (((name.charCodeAt(0) * 7 + name.length * 3) % 9) / 9) * 0.08;
      states[name] = { id: name, name, mesh, cap, line, group: g, tone, heat: 0, hover: 0 };
    }

    // strong state outline, from the real Tamil Nadu state geometry
    let stateMat: THREE.LineBasicMaterial | null = null;
    const tn = INDIA.find((s) => s.id === "tn");
    if (tn) {
      const pts: number[] = [];
      const y = 0.1;
      for (const ring of tn.rings) {
        for (let i = 0; i < ring.length; i++) {
          const p = projection(ring[i] as [number, number])!;
          const q = projection(ring[(i + 1) % ring.length] as [number, number])!;
          pts.push(p[0] - CX, y, p[1] - CZ, q[0] - CX, y, q[1] - CZ);
        }
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      stateMat = new THREE.LineBasicMaterial({ color: PAL.dark.state.clone() });
      mapGroup.add(new THREE.LineSegments(sg, stateMat));
    }

    // ---- PIN-code markers: ordinary HTML map pins for the focused district ----
    // Pincode survey areas are visual approximations unless official polygon
    // boundaries are available.
    const pinRoot = pinRef.current;
    type PinEl = { el: HTMLButtonElement; path: SVGPathElement; label: HTMLSpanElement; pincode: string; lng: number; lat: number; samples: number; results: PartyResult };
    let pins: PinEl[] = [];
    const pinHover = { current: null as string | null };
    const clearPins = () => { for (const p of pins) { p.el.remove(); p.label.remove(); } pins = []; pinHover.current = null; };
    const rebuildPins = () => {
      clearPins();
      if (!pinRoot) return;
      const { mode: m, activeDistrict: act, districts: rows, layers: lay } = live.current;
      if (m !== "pincode" || !act || !lay.pins) return;
      const row = rows.find((r) => r.district === act);
      if (!row) return;
      for (const p of row.pincodes) {
        const el = document.createElement("button");
        el.type = "button";
        el.setAttribute("aria-label", `PIN ${p.pincode}, ${p.district}`);
        el.className = "pointer-events-auto absolute left-0 top-0 cursor-pointer outline-none will-change-transform";
        el.innerHTML = '<svg width="16" height="22" viewBox="0 0 18 26" fill="none"><path d="M9 1C4.58 1 1 4.58 1 9c0 5.6 8 16 8 16s8-10.4 8-16c0-4.42-3.58-8-8-8Z" fill="#2f6fd0" stroke="currentColor" stroke-width="1.4"/><circle cx="9" cy="9" r="3" fill="var(--map-halo)"/></svg>';
        const path = el.querySelector("path") as SVGPathElement;
        el.style.color = "var(--map-sel-line)";
        el.addEventListener("mouseenter", () => (pinHover.current = p.pincode));
        el.addEventListener("mouseleave", () => { if (pinHover.current === p.pincode) pinHover.current = null; });
        el.addEventListener("click", (e) => { e.stopPropagation(); live.current.onSelectPincode(p.pincode); });
        pinRoot.appendChild(el);
        const label = document.createElement("span");
        label.textContent = p.pincode;
        label.className = "pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded px-1 py-px text-[9.5px] font-semibold tabular-nums will-change-transform";
        label.style.opacity = "0";
        pinRoot.appendChild(label);
        pins.push({ el, path, label, pincode: p.pincode, lng: p.lng, lat: p.lat, samples: p.samples, results: p.results });
      }
    };
    rebuildPins();

    // ---- district labels ----
    const labelRoot = labelRef.current;
    const districtLabels: Record<string, HTMLSpanElement> = {};
    if (labelRoot) {
      for (const row of live.current.districts) {
        const el = document.createElement("span");
        el.textContent = row.district;
        el.className = "absolute left-0 top-0 whitespace-nowrap font-semibold tracking-[0.01em] will-change-transform";
        el.style.transform = "translate(-50%,-50%)";
        el.style.opacity = "0";
        el.style.fontSize = "11px";
        labelRoot.appendChild(el);
        districtLabels[row.district] = el;
      }
    }

    // ---- camera (flat, north-up top-down view) ----
    let theta = 0.0, phi = 0.04, dist = 1700;
    const target = new THREE.Vector3(0, 0, 0);
    const desired = { tx: 0, tz: 0, dist: 1700 };
    const labelV = new THREE.Vector3();
    const oxBase = () => (typeof window !== "undefined" && window.innerWidth > 1024 ? 150 : 0);

    const applyCamera = () => {
      camera.position.set(
        target.x + dist * Math.sin(phi) * Math.sin(theta),
        dist * Math.cos(phi),
        target.z + dist * Math.sin(phi) * Math.cos(theta),
      );
      camera.lookAt(target);
    };

    const setSelection = (selected: string[]) => {
      const OX = oxBase();
      if (selected.length === 0) { desired.tx = OX; desired.tz = 0; desired.dist = 1700; }
      else if (selected.length === 1) {
        const { lng, lat } = districtCentroid(selected[0]);
        const [x, z] = projectLngLat(lng, lat);
        desired.tx = OX + x * 0.9; desired.tz = z * 0.9;
        const rr = districtRadius(selected[0]);
        desired.dist = live.current.mode === "pincode" ? clamp(rr * 2200 + 560, 620, 1300) : clamp(rr * 2600 + 720, 900, 1500);
      } else {
        let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
        for (const n of selected) {
          const { lng, lat } = districtCentroid(n);
          const [x, z] = projectLngLat(lng, lat);
          minx = Math.min(minx, x); maxx = Math.max(maxx, x);
          minz = Math.min(minz, z); maxz = Math.max(maxz, z);
        }
        const span = Math.max(maxx - minx, maxz - minz, 300);
        desired.tx = OX + ((minx + maxx) / 2) * 0.85;
        desired.tz = ((minz + maxz) / 2) * 0.85;
        desired.dist = clamp(span * 2.9 + 900, 1350, 2900);
      }
    };

    // ---- pointer / resize ----
    const pointers = new Map<number, { x: number; y: number }>();
    let dragging = false, dragMoved = false, lastX = 0, lastY = 0, pinchDist = 0;
    const mouse = { x: 0, y: 0, px: -1, py: -1 };
    let hovered: string | null = null;
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
      mouse.x = (lp.x / lp.w) * 2 - 1; mouse.y = (lp.y / lp.h) * 2 - 1;
      mouse.px = e.clientX; mouse.py = e.clientY;
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, lp);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) { dist = clamp(dist * (pinchDist / d), 700, 3200); desired.dist = dist; }
        pinchDist = d; return;
      }
      if (dragging) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
        theta = clamp(theta - dx * 0.005, -0.6, 0.6);
        phi = clamp(phi - dy * 0.004, 0.01, 1.1);
        desired.tx = target.x; desired.tz = target.z; desired.dist = dist;
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (pointers.size === 0) {
        const wasDrag = dragMoved; dragging = false; dragMoved = false;
        if (!wasDrag) {
          if (hovered) live.current.onSelectDistrict(hovered);
          else { live.current.onSelectPincode(null); live.current.onSelectDistrict(null); }
        }
      }
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); dist = clamp(dist * (1 + e.deltaY * 0.0012), 700, 3200); desired.dist = dist; };
    const onLeave = () => { mouse.px = -1; mouse.py = -1; hovered = null; tipRef.current = null; };

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

    // ---- frame ----
    const frame = () => {
      const k = reduced ? 1 : 0.12;
      target.x += (desired.tx - target.x) * k;
      target.z += (desired.tz - target.z) * k;
      dist += (desired.dist - dist) * (reduced ? 1 : 0.1);
      applyCamera();

      const { selectedDistricts: sel, hoveredDistrict: hv, activePincode: pin } = live.current;
      const lay = live.current.layers;
      const P = PAL[live.current.theme];
      const selSet = sel.length ? new Set(sel) : null;

      // hover raycast
      let hoveredFound: string | null = null;
      if (mouse.px >= 0) {
        const r = canvas.getBoundingClientRect();
        ndc.set(((mouse.px - r.left) / r.width) * 2 - 1, -(((mouse.py - r.top) / r.height) * 2 - 1));
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObjects(pickables, false)[0];
        hoveredFound = hit ? (hit.object.userData.id as string) : null;
      }
      if (hoveredFound !== hovered) { hovered = hoveredFound; live.current.onHoverDistrict(hoveredFound); }
      canvas.style.cursor = hovered || dragging ? (dragging ? "grabbing" : "pointer") : "grab";

      for (const id in states) {
        const st = states[id];
        const isSelected = selSet ? selSet.has(st.name) : false;
        const isHover = hv === id || hovered === id;
        st.heat += ((isSelected ? 1 : 0) - st.heat) * 0.15;
        st.hover += ((isHover ? 1 : 0) - st.hover) * 0.2;
        const baseFill = P.fill.clone().multiplyScalar(st.tone);
        const target = baseFill.lerp(P.hover, st.hover * (1 - st.heat)).lerp(P.sel, st.heat);
        st.cap.color.lerp(target, 0.25);
        st.line.color.copy(P.line).lerp(P.selLine, st.heat);
        st.line.opacity = lay.boundaries ? 0.9 : 0;
        st.group.position.y = st.heat * 1.5 + st.hover * 0.8;
      }
      if (stateMat) { stateMat.color.copy(P.state); stateMat.opacity = lay.boundaries ? 1 : 0; stateMat.transparent = true; }

      // projection helper
      const hostRect = host.getBoundingClientRect();
      const toScreen = (x: number, y: number, z: number) => {
        labelV.set(x, y, z).project(camera);
        return { x: (labelV.x * 0.5 + 0.5) * hostRect.width, y: (-labelV.y * 0.5 + 0.5) * hostRect.height, behind: labelV.z > 1 };
      };

      // PIN pins (focused district)
      const pinDistrict = sel.length === 1 ? sel[0] : null;
      const showPins = live.current.mode === "pincode" && !!pinDistrict && lay.pins;
      const hoverRef: { pos: { x: number; y: number } | null } = { pos: null };
      let cwx = 0, cwz = 0, spreadF = 1;
      if (pinDistrict) {
        const c = districtCentroid(pinDistrict);
        [cwx, cwz] = projectLngLat(c.lng, c.lat);
        spreadF = clamp(0.26 / districtRadius(pinDistrict), 1, 3);
      }
      if (pins.length) {
        const step = Math.max(1, Math.ceil(pins.length / 10));
        pins.forEach((mk, i) => {
          if (!showPins) { if (mk.el.style.display !== "none") mk.el.style.display = "none"; if (mk.label.style.opacity !== "0") mk.label.style.opacity = "0"; return; }
          const [rwx, rwz] = projectLngLat(mk.lng, mk.lat);
          const p = toScreen(cwx + (rwx - cwx) * spreadF, 0.5, cwz + (rwz - cwz) * spreadF);
          if (p.behind) { mk.el.style.display = "none"; mk.label.style.opacity = "0"; return; }
          mk.el.style.display = "";
          mk.el.style.transform = `translate(-50%,-100%) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
          const isSel = pin === mk.pincode;
          const isHover = pinHover.current === mk.pincode;
          mk.path.setAttribute("fill", isSel ? "var(--map-sel-line)" : isHover ? "#4c86d6" : "#2f6fd0");
          mk.el.style.zIndex = isSel ? "3" : isHover ? "2" : "1";
          if (isHover) hoverRef.pos = { x: hostRect.left + p.x, y: hostRect.top + p.y };
          const showLabel = isSel || isHover || (dist < 1150 && i % step === 0);
          if (!showLabel) { if (mk.label.style.opacity !== "0") mk.label.style.opacity = "0"; return; }
          mk.label.style.transform = `translate(-50%,-165%) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
          mk.label.style.opacity = isSel ? "1" : "0.85";
          mk.label.style.color = isSel ? "#ffffff" : "var(--map-label)";
          mk.label.style.background = isSel ? "var(--map-sel-line)" : "var(--map-halo)";
        });
      }

      // tooltip
      if (hoverRef.pos) {
        const mk = pins.find((x) => x.pincode === pinHover.current);
        if (mk) {
          const data = { kind: "pincode", pincode: mk.pincode, district: pinDistrict ?? "", samples: mk.samples, results: mk.results, pollType: live.current.pollType } as MapTooltipData;
          tipRef.current = { x: hoverRef.pos.x, y: hoverRef.pos.y };
          setTip((prev) => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
        }
      } else if (hovered && mouse.px >= 0 && !dragging) {
        const row = live.current.districts.find((r) => r.district === hovered);
        if (row) {
          const data = { kind: "district", name: hovered, samples: row.samples, results: row.results } as MapTooltipData;
          tipRef.current = { x: mouse.px, y: mouse.py };
          setTip((prev) => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
        } else if (tipRef.current) { tipRef.current = null; setTip(null); }
      } else if (tipRef.current) { tipRef.current = null; setTip(null); }

      // district labels — collision-aware; more revealed as you zoom in
      const zoomed = dist < 1500;
      const placed: { x: number; y: number }[] = [];
      const order = live.current.districts.map((d) => d.district).sort((a, b) => districtRadius(b) - districtRadius(a));
      for (const name of order) {
        const el = districtLabels[name];
        if (!el) continue;
        const isSel = selSet ? selSet.has(name) : true;
        const big = districtRadius(name) >= 0.18;
        if (!isSel || !lay.labels || (!zoomed && !big)) { if (el.style.opacity !== "0") el.style.opacity = "0"; continue; }
        const { lng, lat } = districtCentroid(name);
        const [wx, wz] = projectLngLat(lng, lat);
        const p = toScreen(wx, 0.6, wz);
        if (p.behind) { el.style.opacity = "0"; continue; }
        const focused = pinDistrict === name;
        const collide = placed.some((q) => Math.abs(q.x - p.x) < 30 && Math.abs(q.y - p.y) < 14);
        if (collide && !focused) { if (el.style.opacity !== "0") el.style.opacity = "0"; continue; }
        placed.push({ x: p.x, y: p.y });
        el.style.transform = `translate(-50%,-50%) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
        el.style.opacity = focused ? "1" : "0.82";
        el.style.color = focused ? "var(--map-sel-line)" : P.label;
        el.style.textShadow = `0 1px 3px ${P.halo}, 0 0 6px ${P.halo}`;
        el.style.fontSize = focused ? "12.5px" : "11px";
      }

      renderer.render(scene, camera);
    };
    const stop = rafLoop(frame);
    setReady(true);

    apiRef.current = {
      rebuildPins,
      setSelection,
      reset: () => { theta = 0; phi = 0.04; dist = 1700; desired.tx = oxBase(); desired.tz = 0; desired.dist = 1700; },
    };

    return () => {
      stop();
      ro.disconnect();
      clearPins();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      apiRef.current = null;
    };
  }, [projection, projectLngLat]);

  useEffect(() => { apiRef.current?.rebuildPins(); }, [mode, activeDistrict, pollType, pollData, layers.pins]);
  useEffect(() => { apiRef.current?.setSelection(selectedDistricts); }, [selectedDistricts]);
  useEffect(() => { if (resetNonce) apiRef.current?.reset(); }, [resetNonce]);

  return (
    <div ref={hostRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" aria-label="2.5D map of Tamil Nadu districts" role="img" />
      <div ref={labelRef} className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden />
      <div ref={pinRef} className="pointer-events-none absolute inset-0 z-[6] overflow-hidden" />

      {!ready && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Loading Tamil Nadu…</div>}

      {/* legend */}
      <div className="pointer-events-none absolute bottom-4 left-[31%] z-10 hidden rounded-xl border border-border bg-card/80 px-3 py-2 backdrop-blur-md lg:block">
        <ul className="space-y-1 text-[10.5px] text-muted-foreground">
          <li className="flex items-center gap-2"><span className="size-3 rounded-[3px] border" style={{ background: "var(--map-sel)", borderColor: "var(--map-sel-line)" }} /> Selected district</li>
          <li className="flex items-center gap-2"><span className="size-3 rounded-[3px] border" style={{ background: "var(--map-fill)", borderColor: "var(--map-line)" }} /> District</li>
          <li className="flex items-center gap-2"><span className="size-3 rounded-[3px]" style={{ background: "var(--map-state)" }} /> State outline</li>
        </ul>
      </div>

      {tip && tipRef.current && <MapTooltip data={tip} x={tipRef.current.x} y={tipRef.current.y} />}
    </div>
  );
}
