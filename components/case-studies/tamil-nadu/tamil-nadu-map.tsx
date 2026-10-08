"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { geoIdentity } from "d3-geo";
import { rafLoop } from "@/lib/raf-loop";
import TN_GEO from "@/lib/data/tamil-nadu-districts.json";
import {
  districtCentroid,
  districtRadius,
  type DistrictPollResult,
  type PartyResult,
  type PollType,
} from "@/lib/data/tamil-nadu-poll-data";
import MapTooltip, { type MapTooltipData } from "./map-tooltip";

/* =====================================================================
   Interactive 3D Tamil Nadu district map.
   Only Tamil Nadu is ever drawn — no India, no neighbouring states.
   Boundary data: lib/data/tamil-nadu-districts.json (see that module's
   header for the source).
   ===================================================================== */

type GeoFeature = { type: "Feature"; properties: { district: string }; geometry: { type: string; coordinates: unknown } };
const FC = TN_GEO as unknown as { type: "FeatureCollection"; features: GeoFeature[] };

const BOX = 1000; // projected map is fitted into a 1000×1000 box
const DEPTH = 7; // 2.5D extrusion (visible glowing side walls)
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

type Props = {
  pollType: PollType;
  districts: DistrictPollResult[];
  selectedDistricts: string[];
  activeDistrict: string | null;
  hoveredDistrict: string | null;
  activePincode: string | null;
  mode: MapMode;
  layers: MapLayers;
  resetNonce?: number;
  onHoverDistrict: (name: string | null) => void;
  onSelectDistrict: (name: string | null) => void;
  onSelectPincode: (pincode: string | null) => void;
};

export type MapMode = "state" | "district" | "pincode";
export type MapLayers = { boundaries: boolean; pins: boolean; labels: boolean; context: boolean };

type DistrictState = {
  id: string;
  name: string;
  mesh: THREE.Mesh;
  cap: THREE.MeshStandardMaterial;
  side: THREE.MeshStandardMaterial;
  line: THREE.LineBasicMaterial;
  group: THREE.Group;
  target: THREE.Color;
  heat: number;
  hover: number;
  focus: number;
};

export default function TamilNaduMap(props: Props) {
  const {
    pollType,
    districts: pollData,
    selectedDistricts,
    activeDistrict,
    hoveredDistrict,
    activePincode,
    mode,
    layers,
    resetNonce,
    onHoverDistrict,
    onSelectDistrict,
    onSelectPincode,
  } = props;

  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<{ x: number; y: number } | null>(null);
  const [tip, setTip] = useState<MapTooltipData | null>(null);
  const [ready, setReady] = useState(false);

  // latest props for the (stable) rAF frame
  const live = useRef({ pollType, districts: pollData, selectedDistricts, activeDistrict, hoveredDistrict, activePincode, mode, layers, onHoverDistrict, onSelectDistrict, onSelectPincode });
  live.current = { pollType, districts: pollData, selectedDistricts, activeDistrict, hoveredDistrict, activePincode, mode, layers, onHoverDistrict, onSelectDistrict, onSelectPincode };

  const apiRef = useRef<{
    rebuildPins: () => void;
    setSelection: (selected: string[]) => void;
    reset: () => void;
  } | null>(null);

  // stable projection used both for geometry and for lng/lat → world lookups.
  // The boundary rings are clockwise-wound, which would make a spherical
  // projection (geoMercator) read Tamil Nadu as the complement of the globe —
  // so a planar identity projection is used instead (accurate enough at this
  // scale, and immune to ring orientation).
  const projection = useMemo(() => {
    return geoIdentity().reflectY(true).fitExtent(
      [
        [40, 40],
        [BOX - 40, BOX - 40],
      ],
      FC as never,
    );
  }, []);

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
      return; // WebGL unavailable — the rest of the page still works
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setClearAlpha(0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 1, 9000);

    // ---- lights (dark navy caps, glowing blue district walls) ----
    scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x061027, 0.55));
    const sun = new THREE.DirectionalLight(0xdfe9ff, 1.35);
    sun.position.set(-320, 640, 420);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x6fa8ff, 0.55);
    rim.position.set(460, 160, -560);
    scene.add(rim);
    const hub = new THREE.PointLight(0xffa640, 0, 180, 0);
    scene.add(hub);

    // ---- soft radial texture for glows / survey nodes ----
    const radialTex = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d")!;
      const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, "rgba(255,255,255,1)");
      r.addColorStop(0.28, "rgba(255,255,255,.55)");
      r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r;
      g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();

    /* Survey-zone marker: a soft fill with a crisp boundary ring, so PINs
       read as survey areas rather than glowing dots.
       Pincode survey areas are visual approximations for UI and are not
       official postal boundary polygons. */

    // ---- ground glow under the state ----
    const under = new THREE.Mesh(
      new THREE.PlaneGeometry(1500, 1500),
      new THREE.MeshBasicMaterial({ map: radialTex, color: 0x5b8fe0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    under.rotation.x = -Math.PI / 2;
    under.position.y = -DEPTH + 0.1;
    scene.add(under);

    // faint cartographic grid on the "ocean" floor
    const grid = new THREE.GridHelper(3600, 90, 0x24579f, 0x14335f);
    grid.position.y = -DEPTH - 1.5;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.22;
    scene.add(grid);

    // ---- districts ----
    const mapGroup = new THREE.Group();
    scene.add(mapGroup);

    const C_BASE = new THREE.Color(0x0e2454);
    const C_DIM = new THREE.Color(0x0a1a3e);
    const C_SEL = new THREE.Color(0x1b3f8a);
    const C_HOVER = new THREE.Color(0x3172d6);
    const C_ACTIVE = new THREE.Color(0xe36310);
    const S_BASE = new THREE.Color(0x0a1a3c);
    const S_ACTIVE = new THREE.Color(0x9a3d00);
    const EMIS_BLUE = new THREE.Color(0x1f6fff);
    const EMIS_ORANGE = new THREE.Color(0xff7a1a);

    const states: Record<string, DistrictState> = {};
    const pickables: THREE.Mesh[] = [];

    for (const f of FC.features) {
      const name = f.properties.district;
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];

      const shapes: THREE.Shape[] = [];
      for (const poly of polys) {
        const toVec = (ring: number[][]) =>
          ring.map(([lng, lat]) => {
            const p = projection([lng, lat])!;
            return new THREE.Vector2(p[0] - CX, p[1] - CZ);
          });
        const outer = toVec(poly[0]);
        if (outer.length < 3) continue;
        if (signedArea(poly[0]) < 0) outer.reverse(); // outer CCW in y-down space
        const shape = new THREE.Shape(outer);
        for (let h = 1; h < poly.length; h++) {
          const hole = toVec(poly[h]);
          if (hole.length < 3) continue;
          if (signedArea(poly[h]) > 0) hole.reverse(); // holes CW
          shape.holes.push(new THREE.Path(hole));
        }
        shapes.push(shape);
      }
      if (shapes.length === 0) continue;

      const geo = new THREE.ExtrudeGeometry(shapes, {
        depth: DEPTH,
        bevelEnabled: true,
        bevelThickness: 0.3,
        bevelSize: 0.28,
        bevelSegments: 1,
        curveSegments: 1,
      });
      geo.rotateX(Math.PI / 2);
      geo.translate(0, DEPTH, 0);

      const cap = new THREE.MeshStandardMaterial({ color: C_BASE.clone(), roughness: 0.62, metalness: 0.22, emissive: 0xff7a1a, emissiveIntensity: 0, side: THREE.DoubleSide });
      const side = new THREE.MeshStandardMaterial({ color: S_BASE.clone(), roughness: 0.5, metalness: 0.12, emissive: EMIS_BLUE.clone(), emissiveIntensity: 0.9, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, [cap, side]);
      mesh.userData.id = name;
      pickables.push(mesh);

      // thin district boundary line sitting on the top cap
      const pts: number[] = [];
      const y = DEPTH + 0.06;
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
      const line = new THREE.LineBasicMaterial({ color: 0x63b4ff, transparent: true, opacity: 0.7 });
      mapGroup.add(new THREE.LineSegments(lg, line));

      const g = new THREE.Group();
      g.add(mesh);
      mapGroup.add(g);
      states[name] = { id: name, name, mesh, cap, side, line, group: g, target: C_BASE.clone(), heat: 0, hover: 0, focus: 0 };
    }

    // ---- PIN-code markers: ordinary HTML map pins for the focused district ----
    // Positions use real geographic coordinates of each survey point. Survey
    // areas are visual approximations unless official polygon boundaries exist.
    const pinRoot = pinRef.current;
    type PinEl = { el: HTMLButtonElement; path: SVGPathElement; label: HTMLSpanElement; pincode: string; lng: number; lat: number; samples: number; results: PartyResult };
    let pins: PinEl[] = [];
    const pinHover = { current: null as string | null };

    const clearPins = () => {
      for (const p of pins) { p.el.remove(); p.label.remove(); }
      pins = [];
      pinHover.current = null;
    };

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
        el.innerHTML =
          '<svg width="18" height="26" viewBox="0 0 18 26" fill="none"><path d="M9 1C4.58 1 1 4.58 1 9c0 5.6 8 16 8 16s8-10.4 8-16c0-4.42-3.58-8-8-8Z" fill="#3d8bfd" stroke="rgba(255,255,255,.9)" stroke-width="1"/><circle cx="9" cy="9" r="3.1" fill="#04091a"/></svg>';
        const path = el.querySelector("path") as SVGPathElement;
        el.addEventListener("mouseenter", () => (pinHover.current = p.pincode));
        el.addEventListener("mouseleave", () => { if (pinHover.current === p.pincode) pinHover.current = null; });
        el.addEventListener("click", (e) => { e.stopPropagation(); live.current.onSelectPincode(p.pincode); });
        pinRoot.appendChild(el);

        const label = document.createElement("span");
        label.textContent = p.pincode;
        label.className = "pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded bg-[#050b1f]/85 px-1 py-px text-[9.5px] font-medium tabular-nums text-white/85 will-change-transform";
        label.style.opacity = "0";
        pinRoot.appendChild(label);

        pins.push({ el, path, label, pincode: p.pincode, lng: p.lng, lat: p.lat, samples: p.samples, results: p.results });
      }
    };
    rebuildPins();

    // ---- camera state ----
    let theta = 0.1, phi = 1.0, dist = 1500;
    const target = new THREE.Vector3(0, 0, 0);
    const desired = { tx: 0, tz: 0, dist: 1500 };
    const labelV = new THREE.Vector3();

    // ---- HTML labels: district names, plus pincode labels for a focused district ----
    const labelRoot = labelRef.current;
    const districtLabels: Record<string, HTMLSpanElement> = {};
    if (labelRoot) {
      for (const row of live.current.districts) {
        const d = document.createElement("span");
        d.textContent = row.district;
        d.className = "absolute left-0 top-0 whitespace-nowrap font-semibold tracking-[0.02em] will-change-transform";
        d.style.transform = "translate(-50%,-50%)";
        d.style.opacity = "0";
        d.style.fontSize = "10px";
        d.style.color = "rgba(226,236,255,.72)";
        d.style.textShadow = "0 1px 6px rgba(0,0,0,.85)";
        labelRoot.appendChild(d);
        districtLabels[row.district] = d;
      }
    }

    // neighbouring geography labels (static, projected each frame)
    const NEIGHBOURS: { text: string; lng: number; lat: number }[] = [
      { text: "KARNATAKA", lng: 76.7, lat: 13.7 },
      { text: "KERALA", lng: 76.1, lat: 10.1 },
      { text: "BAY OF BENGAL", lng: 81.7, lat: 12.0 },
      { text: "SRI LANKA", lng: 80.3, lat: 7.7 },
    ];
    const neighbourEls: { el: HTMLSpanElement; lng: number; lat: number }[] = [];
    if (labelRoot) {
      for (const n of NEIGHBOURS) {
        const el = document.createElement("span");
        el.textContent = n.text;
        el.className = "absolute left-0 top-0 whitespace-nowrap font-semibold tracking-[0.3em] will-change-transform";
        el.style.transform = "translate(-50%,-50%)";
        el.style.opacity = "0";
        el.style.fontSize = "11px";
        el.style.color = "rgba(150,185,235,.42)";
        el.style.textShadow = "0 1px 8px rgba(0,0,0,.9)";
        labelRoot.appendChild(el);
        neighbourEls.push({ el, lng: n.lng, lat: n.lat });
      }
    }

    const applyCamera = () => {
      camera.position.set(
        target.x + dist * Math.sin(phi) * Math.sin(theta),
        dist * Math.cos(phi),
        target.z + dist * Math.sin(phi) * Math.cos(theta),
      );
      camera.lookAt(target);
    };

    const setSelection = (selected: string[]) => {
      // on desktop, nudge the framing left so the floating panels never sit on
      // top of the state
      const OX = typeof window !== "undefined" && window.innerWidth > 1024 ? 150 : 0;
      if (selected.length === 0) {
        desired.tx = OX; desired.tz = 0; desired.dist = 1500;
      } else if (selected.length === 1) {
        const { lng, lat } = districtCentroid(selected[0]);
        const [x, z] = projectLngLat(lng, lat);
        desired.tx = OX + x * 0.9; desired.tz = z * 0.9;
        const rr = districtRadius(selected[0]);
        desired.dist = live.current.mode === "pincode"
          ? clamp(rr * 2200 + 480, 560, 1300)
          : clamp(rr * 2800 + 650, 820, 1500);
      } else {
        // fit the camera around the selected districts, keeping context
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
        desired.dist = clamp(span * 2.9 + 700, 1250, 2750);
      }
    };

    // ---- pointer / resize ----
    const pointers = new Map<number, { x: number; y: number }>();
    let dragging = false, dragMoved = false, lastX = 0, lastY = 0, pinchDist = 0;
    const mouse = { x: 0, y: 0, px: -1, py: -1 };
    let hovered: string | null = null;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const localPoint = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
    };

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, localPoint(e));
      if (pointers.size === 1) {
        dragging = true;
        dragMoved = false;
        lastX = e.clientX;
        lastY = e.clientY;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      const lp = localPoint(e);
      mouse.x = (lp.x / lp.w) * 2 - 1;
      mouse.y = (lp.y / lp.h) * 2 - 1;
      mouse.px = e.clientX;
      mouse.py = e.clientY;
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, lp);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) { dist = clamp(dist * (pinchDist / d), 900, 3000); desired.dist = dist; }
        pinchDist = d;
        return;
      }
      if (dragging) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
        theta = clamp(theta - dx * 0.005, -0.95, 0.95);
        phi = clamp(phi - dy * 0.004, 0.35, 1.34);
        desired.tx = target.x; desired.tz = target.z; desired.dist = dist;
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (pointers.size === 0) {
        const wasDrag = dragMoved;
        dragging = false;
        dragMoved = false;
        if (!wasDrag) {
          if (hovered) {
            live.current.onSelectDistrict(hovered);
          } else {
            live.current.onSelectPincode(null);
            live.current.onSelectDistrict(null);
          }
        }
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      dist = clamp(dist * (1 + e.deltaY * 0.0012), 900, 3000);
      desired.dist = dist;
    };
    const onLeave = () => {
      mouse.px = -1; mouse.py = -1;
      hovered = null;
      tipRef.current = null;
    };

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
      // camera easing
      const k = reduced ? 1 : 0.12;
      target.x += (desired.tx - target.x) * k;
      target.z += (desired.tz - target.z) * k;
      dist += (desired.dist - dist) * (reduced ? 1 : 0.1);
      if (!reduced) theta = clamp(theta + Math.sin(performance.now() / 6000) * 0.00006, -0.95, 0.95);
      applyCamera();

      const { selectedDistricts: sel, activeDistrict: act, hoveredDistrict: hv, activePincode: pin } = live.current;
      const lay = live.current.layers;
      const selSet = sel.length ? new Set(sel) : null;

      // district hover (raycast)
      let hoveredFound: string | null = null;
      if (mouse.px >= 0) {
        const r = canvas.getBoundingClientRect();
        ndc.set(((mouse.px - r.left) / r.width) * 2 - 1, -(((mouse.py - r.top) / r.height) * 2 - 1));
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObjects(pickables, false)[0];
        hoveredFound = hit ? (hit.object.userData.id as string) : null;
      }
      if (hoveredFound !== hovered) {
        hovered = hoveredFound;
        live.current.onHoverDistrict(hoveredFound);
      }
      canvas.style.cursor = hovered || dragging ? (dragging ? "grabbing" : "pointer") : "grab";

      for (const id in states) {
        const st = states[id];
        const isHighlighted = selSet ? selSet.has(st.name) : act === id;
        const isHover = hv === id || hovered === id;
        const inSel = !selSet || selSet.has(st.name);
        st.heat += ((isHighlighted ? 1 : 0) - st.heat) * 0.12;
        st.hover += ((isHover ? 1 : 0) - st.hover) * 0.18;
        st.focus += ((inSel ? 1 : 0) - st.focus) * 0.12;
        const base = C_BASE.clone().lerp(C_DIM, 1 - st.focus);
        st.target.copy(base).lerp(C_SEL, st.focus * 0.5).lerp(C_HOVER, st.hover * (1 - st.heat) * (inSel ? 1 : 0.2)).lerp(C_ACTIVE, st.heat);
        st.cap.color.lerp(st.target, 0.2);
        st.cap.emissiveIntensity = st.heat * 0.5 + st.hover * 0.12;
        st.side.color.copy(S_BASE).lerp(S_ACTIVE, st.heat);
        st.side.emissive.copy(EMIS_BLUE).lerp(EMIS_ORANGE, st.heat);
        st.side.emissiveIntensity = 0.85 + st.heat * 0.7 + st.hover * 0.25;
        st.line.opacity = lay.boundaries ? (inSel ? 0.7 : 0.28) + st.hover * 0.3 + st.heat * 0.25 : 0;
        st.group.position.y = st.heat * 6 + st.hover * 3;
      }

      // ---- screen projection helper ----
      const hostRect = host.getBoundingClientRect();
      const toScreen = (x: number, y: number, z: number) => {
        labelV.set(x, y, z).project(camera);
        return { x: (labelV.x * 0.5 + 0.5) * hostRect.width, y: (-labelV.y * 0.5 + 0.5) * hostRect.height, behind: labelV.z > 1 };
      };

      // ---- PIN-code pins (ordinary map pins for the focused district) ----
      const pinDistrict = sel.length === 1 ? sel[0] : null;
      const showPins = live.current.mode === "pincode" && !!pinDistrict && lay.pins;
      const hoverRef: { pos: { x: number; y: number } | null } = { pos: null };
      let cwx = 0, cwz = 0, spreadF = 1;
      if (pinDistrict) {
        const c = districtCentroid(pinDistrict);
        [cwx, cwz] = projectLngLat(c.lng, c.lat);
        // Tiny districts (e.g. Chennai) get a modest spread so their PINs stay
        // separable. PIN survey areas are visual approximations.
        spreadF = clamp(0.26 / districtRadius(pinDistrict), 1, 3);
      }
      if (pins.length) {
        const step = Math.max(1, Math.ceil(pins.length / 10));
        pins.forEach((mk, i) => {
          if (!showPins) {
            if (mk.el.style.display !== "none") mk.el.style.display = "none";
            if (mk.label.style.opacity !== "0") mk.label.style.opacity = "0";
            return;
          }
          const [rwx, rwz] = projectLngLat(mk.lng, mk.lat);
          const p = toScreen(cwx + (rwx - cwx) * spreadF, DEPTH + 3, cwz + (rwz - cwz) * spreadF);
          if (p.behind) { mk.el.style.display = "none"; mk.label.style.opacity = "0"; return; }
          mk.el.style.display = "";
          mk.el.style.transform = `translate(-50%,-100%) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
          const isSel = pin === mk.pincode;
          const isHover = pinHover.current === mk.pincode;
          mk.path.setAttribute("fill", isSel ? "#ff8a2b" : isHover ? "#79b0ff" : "#3d8bfd");
          mk.el.style.zIndex = isSel ? "3" : isHover ? "2" : "1";
          if (isHover) hoverRef.pos = { x: hostRect.left + p.x, y: hostRect.top + p.y };
          const showLabel = isSel || isHover || (dist < 1100 && i % step === 0);
          if (!showLabel) { if (mk.label.style.opacity !== "0") mk.label.style.opacity = "0"; return; }
          mk.label.style.transform = `translate(-50%,-165%) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
          mk.label.style.opacity = isSel ? "1" : "0.8";
          mk.label.style.color = isSel ? "#ffffff" : "rgba(255,255,255,.85)";
          mk.label.style.background = isSel ? "rgba(255,122,26,.9)" : "rgba(5,11,31,.85)";
        });
      }

      // ---- tooltip ----
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
      } else if (tipRef.current) {
        tipRef.current = null; setTip(null);
      }

      // district names — collision-aware, hideable via Map Layers
      const placed: { x: number; y: number }[] = [];
      const labelOrder = live.current.districts.map((d) => d.district).sort((a, b) => districtRadius(b) - districtRadius(a));
      for (const name of labelOrder) {
        const el = districtLabels[name];
        if (!el) continue;
        const isSel = selSet ? selSet.has(name) : true;
        if (!isSel || !lay.labels) { if (el.style.opacity !== "0") el.style.opacity = "0"; continue; }
        const { lng, lat } = districtCentroid(name);
        const [wx, wz] = projectLngLat(lng, lat);
        const p = toScreen(wx, DEPTH + 7, wz);
        if (p.behind) { el.style.opacity = "0"; continue; }
        const focused = pinDistrict === name;
        const collide = placed.some((q) => Math.abs(q.x - p.x) < 34 && Math.abs(q.y - p.y) < 15);
        if (collide && !focused) { if (el.style.opacity !== "0") el.style.opacity = "0"; continue; }
        placed.push({ x: p.x, y: p.y });
        el.style.transform = `translate(-50%,-50%) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
        el.style.opacity = focused ? "0.98" : "0.62";
        el.style.color = focused ? "#ffc078" : "rgba(226,236,255,.72)";
        el.style.fontSize = focused ? "13px" : "10px";
      }

      // neighbouring geography labels (hideable via Map Layers)
      for (const nb of neighbourEls) {
        if (!lay.context) { if (nb.el.style.opacity !== "0") nb.el.style.opacity = "0"; continue; }
        const [wx, wz] = projectLngLat(nb.lng, nb.lat);
        const p = toScreen(wx, DEPTH - 3, wz);
        nb.el.style.transform = `translate(-50%,-50%) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
        nb.el.style.opacity = p.behind ? "0" : "1";
      }

      renderer.render(scene, camera);
    };
    const stop = rafLoop(frame);
    setReady(true);

    apiRef.current = {
      rebuildPins,
      setSelection,
      reset: () => {
        theta = 0.1; phi = 1.0; dist = 1500;
        desired.tx = typeof window !== "undefined" && window.innerWidth > 1024 ? 150 : 0;
        desired.tz = 0; desired.dist = 1500;
      },
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
      radialTex.dispose();
      apiRef.current = null;
    };
  }, [projection, projectLngLat]);

  // rebuild PIN pins when the mode / focused district / poll type changes
  useEffect(() => {
    apiRef.current?.rebuildPins();
  }, [mode, activeDistrict, pollType, pollData, layers.pins]);

  // camera framing whenever the district selection changes
  useEffect(() => {
    apiRef.current?.setSelection(selectedDistricts);
  }, [selectedDistricts]);

  // external "reset view" trigger
  useEffect(() => {
    if (resetNonce) apiRef.current?.reset();
  }, [resetNonce]);

  return (
    <div ref={hostRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" aria-label="3D map of Tamil Nadu districts with survey points" role="img" />
      <div ref={labelRef} className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden />
      <div ref={pinRef} className="pointer-events-none absolute inset-0 z-[6] overflow-hidden" />

      {/* loading veil */}
      {!ready && (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/45">Loading Tamil Nadu…</div>
      )}

      {/* compass */}
      <div className="pointer-events-none absolute left-[37%] top-5 z-10 hidden -translate-x-1/2 flex-col items-center text-white/55 lg:flex">
        <span className="font-display text-[12px] font-semibold tracking-[0.2em]">N</span>
        <span className="mt-1 h-7 w-px bg-gradient-to-b from-white/50 to-transparent" />
      </div>

      {tip && tipRef.current && <MapTooltip data={tip} x={tipRef.current.x} y={tipRef.current.y} />}
    </div>
  );
}
