"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RotateCcw } from "lucide-react";
import { geoIdentity } from "d3-geo";
import { rafLoop } from "@/lib/raf-loop";
import TN_GEO from "@/lib/data/tamil-nadu-districts.json";
import {
  PARTY_META,
  districtCentroid,
  districtRadius,
  leadingParty,
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
const DEPTH = 4; // shallow 2.5D extrusion
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
  onHoverDistrict: (name: string | null) => void;
  onSelectDistrict: (name: string | null) => void;
  onSelectPincode: (pincode: string | null) => void;
};

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
    onHoverDistrict,
    onSelectDistrict,
    onSelectPincode,
  } = props;

  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<{ x: number; y: number } | null>(null);
  const [tip, setTip] = useState<MapTooltipData | null>(null);
  const [ready, setReady] = useState(false);

  // latest props for the (stable) rAF frame
  const live = useRef({ pollType, districts: pollData, selectedDistricts, activeDistrict, hoveredDistrict, activePincode, onHoverDistrict, onSelectDistrict, onSelectPincode });
  live.current = { pollType, districts: pollData, selectedDistricts, activeDistrict, hoveredDistrict, activePincode, onHoverDistrict, onSelectDistrict, onSelectPincode };

  const apiRef = useRef<{
    rebuildMarkers: () => void;
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

    // ---- lights (mirror the homepage India map) ----
    scene.add(new THREE.HemisphereLight(0xffffff, 0x0a1636, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(-320, 640, 420);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x9cc6ff, 0.7);
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
    const zoneTex = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d")!;
      const r = g.createRadialGradient(64, 64, 0, 64, 64, 50);
      r.addColorStop(0, "rgba(255,255,255,.40)");
      r.addColorStop(0.7, "rgba(255,255,255,.14)");
      r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r;
      g.beginPath();
      g.arc(64, 64, 50, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,.85)";
      g.lineWidth = 5;
      g.beginPath();
      g.arc(64, 64, 48, 0, Math.PI * 2);
      g.stroke();
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();

    // ---- ground glow under the state ----
    const under = new THREE.Mesh(
      new THREE.PlaneGeometry(1500, 1500),
      new THREE.MeshBasicMaterial({ map: radialTex, color: 0x5b8fe0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    under.rotation.x = -Math.PI / 2;
    under.position.y = -DEPTH + 0.1;
    scene.add(under);

    // ---- districts ----
    const mapGroup = new THREE.Group();
    scene.add(mapGroup);

    const C_BASE = new THREE.Color(0x1c3f86);
    const C_DIM = new THREE.Color(0x1c3768);
    const C_SEL = new THREE.Color(0x2f66c8);
    const C_HOVER = new THREE.Color(0x4f8ff0);
    const C_ACTIVE = new THREE.Color(0xd9600a);
    const S_BASE = new THREE.Color(0x0b1c44);
    const S_ACTIVE = new THREE.Color(0x8f3f00);

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

      const cap = new THREE.MeshStandardMaterial({ color: C_BASE.clone(), roughness: 0.5, metalness: 0.28, emissive: 0xff7a1a, emissiveIntensity: 0, side: THREE.DoubleSide });
      const side = new THREE.MeshStandardMaterial({ color: S_BASE.clone(), roughness: 0.72, metalness: 0.3, side: THREE.DoubleSide });
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
      const line = new THREE.LineBasicMaterial({ color: 0x6f95dd, transparent: true, opacity: 0.45 });
      mapGroup.add(new THREE.LineSegments(lg, line));

      const g = new THREE.Group();
      g.add(mesh);
      mapGroup.add(g);
      states[name] = { id: name, name, mesh, cap, side, line, group: g, target: C_BASE.clone(), heat: 0, hover: 0, focus: 0 };
    }

    // ---- survey point markers (rebuilt when data / poll type changes) ----
    const markerGroup = new THREE.Group();
    mapGroup.add(markerGroup);
    let pincodeHits: THREE.Sprite[] = [];
    let clusterHits: THREE.Sprite[] = [];

    const makeSprite = (color: number, opacity: number) => {
      const m = new THREE.SpriteMaterial({ map: zoneTex, color, transparent: true, opacity, blending: THREE.NormalBlending, depthWrite: false, depthTest: false });
      return new THREE.Sprite(m);
    };

    const rebuildMarkers = () => {
      // dispose old
      markerGroup.clear();
      pincodeHits.forEach((s) => s.material.dispose());
      clusterHits.forEach((s) => s.material.dispose());
      pincodeHits = [];
      clusterHits = [];
      const rows = live.current.districts;

      // Individual pincode pin points — revealed only for the focused district.
      for (const row of rows) {
        for (const p of row.pincodes) {
          const lead = leadingParty(p.results);
          const [x, z] = projectLngLat(p.lng, p.lat);
          const s = makeSprite(new THREE.Color(PARTY_META[lead].color).getHex(), 0.85);
          s.position.set(x, DEPTH + 3, z);
          s.scale.setScalar(7 + Math.min(12, p.samples / 45));
          s.userData = { kind: "pincode", pincode: p.pincode, district: p.district, samples: p.samples, results: p.results };
          markerGroup.add(s);
          pincodeHits.push(s);
        }
      }
    };
    rebuildMarkers();

    // ---- camera state ----
    let theta = 0.12, phi = 0.86, dist = 1850;
    const target = new THREE.Vector3(0, 0, 0);
    const desired = { tx: 0, tz: 0, dist: 1850 };
    const labelV = new THREE.Vector3();

    // ---- HTML labels: district names, plus pincode labels for a focused district ----
    const labelRoot = labelRef.current;
    const districtLabels: Record<string, HTMLSpanElement> = {};
    const pinLabels: Record<string, HTMLSpanElement[]> = {};
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

        const arr: HTMLSpanElement[] = [];
        for (const p of row.pincodes) {
          const s = document.createElement("span");
          s.textContent = p.pincode;
          s.className = "absolute left-0 top-0 whitespace-nowrap rounded px-1 py-px text-[9.5px] font-medium tabular-nums will-change-transform";
          s.style.transform = "translate(-50%,-150%)";
          s.style.opacity = "0";
          s.style.background = "rgba(5,11,31,.72)";
          s.style.color = "rgba(255,255,255,.8)";
          labelRoot.appendChild(s);
          arr.push(s);
        }
        pinLabels[row.district] = arr;
      }
    }
    let lastLabelActive: string | null = null;

    const applyCamera = () => {
      camera.position.set(
        target.x + dist * Math.sin(phi) * Math.sin(theta),
        dist * Math.cos(phi),
        target.z + dist * Math.sin(phi) * Math.cos(theta),
      );
      camera.lookAt(target);
    };

    const setSelection = (selected: string[]) => {
      if (selected.length === 0) {
        desired.tx = 0; desired.tz = 0; desired.dist = 1850;
      } else if (selected.length === 1) {
        const { lng, lat } = districtCentroid(selected[0]);
        const [x, z] = projectLngLat(lng, lat);
        desired.tx = x * 0.9; desired.tz = z * 0.9;
        desired.dist = clamp(districtRadius(selected[0]) * 2800 + 650, 820, 1500);
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
        desired.tx = ((minx + maxx) / 2) * 0.85;
        desired.tz = ((minz + maxz) / 2) * 0.85;
        desired.dist = clamp(span * 2.9 + 700, 1250, 2750);
      }
    };

    // ---- pointer / resize ----
    const pointers = new Map<number, { x: number; y: number }>();
    let dragging = false, dragMoved = false, lastX = 0, lastY = 0, pinchDist = 0;
    const mouse = { x: 0, y: 0, px: -1, py: -1 };
    let hovered: string | null = null;
    let hoveredPin: THREE.Sprite | null = null;
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
          if (hoveredPin) {
            const u = hoveredPin.userData as { kind: string; pincode?: string; district?: string };
            if (u.kind === "pincode" && u.pincode) live.current.onSelectPincode(u.pincode);
            else if (u.district) live.current.onSelectDistrict(u.district);
          } else if (hovered) {
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
      hoveredPin = null;
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
      const selSet = sel.length ? new Set(sel) : null;
      const zoomedIn = dist < CLUSTER_DIST;

      // district highlight
      let hoveredFound: string | null = null;
      if (mouse.px >= 0) {
        const r = canvas.getBoundingClientRect();
        ndc.set(((mouse.px - r.left) / r.width) * 2 - 1, -(((mouse.py - r.top) / r.height) * 2 - 1));
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObjects(pickables, false)[0];
        hoveredFound = hit ? (hit.object.userData.id as string) : null;
        // survey-point hits take priority when zoomed in
        if (zoomedIn) {
          const pinHit = ray.intersectObjects(pincodeHits.filter((s) => s.visible), false)[0];
          if (pinHit) hoveredPin = pinHit.object as THREE.Sprite;
          else hoveredPin = null;
        } else {
          const clHit = ray.intersectObjects(clusterHits.filter((s) => s.visible), false)[0];
          hoveredPin = clHit ? (clHit.object as THREE.Sprite) : null;
        }
      } else {
        hoveredPin = null;
      }
      if (hoveredFound !== hovered) {
        hovered = hoveredFound;
        live.current.onHoverDistrict(hoveredFound);
      }
      canvas.style.cursor = hoveredPin || hovered || dragging ? (dragging ? "grabbing" : "pointer") : "grab";

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
        st.cap.emissiveIntensity = st.heat * 0.55 + st.hover * 0.15;
        st.side.color.copy(S_BASE).lerp(S_ACTIVE, st.heat);
        st.line.opacity = (inSel ? 0.45 : 0.18) + st.hover * 0.4 + st.heat * 0.3;
        st.group.position.y = st.heat * 5 + st.hover * 2.5;
      }

      // survey points: district clusters when zoomed out; for a single focused
      // district, reveal its pincodes as individual pin points
      const pinDistrict = sel.length === 1 ? sel[0] : null;
      const pinOp = zoomedIn ? clamp((CLUSTER_DIST - dist) / 240 + 0.15, 0, 1) : 0;
      pincodeHits.forEach((s) => {
        const u = s.userData as { district: string; pincode: string };
        const isPinDistrict = pinDistrict === u.district;
        const isSelPin = pin === u.pincode;
        (s.material as THREE.SpriteMaterial).opacity = pinOp * (isPinDistrict ? 1 : 0) * (isSelPin ? 1 : 0.9);
        s.visible = pinOp > 0.02 && isPinDistrict;
        if (isSelPin) s.scale.setScalar(9 + Math.min(13, (u as { samples?: number }).samples ?? 0) / 40);
      });

      // tooltip
      if ((hoveredPin || (hovered && zoomedIn)) && mouse.px >= 0 && !dragging) {
        let data: MapTooltipData | null = null;
        if (hoveredPin) {
          const u = hoveredPin.userData as Record<string, unknown>;
          if (u.kind === "pincode") data = { kind: "pincode", pincode: u.pincode as string, district: u.district as string, samples: u.samples as number, results: u.results as PartyResult, pollType: live.current.pollType };
          else data = { kind: "cluster", count: u.count as number, district: u.district as string };
        } else if (hovered) {
          const row = live.current.districts.find((r) => r.district === hovered);
          if (row) data = { kind: "district", name: hovered, samples: row.samples, results: row.results };
        }
        if (data) {
          tipRef.current = { x: mouse.px, y: mouse.py };
          setTip((prev) => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
        } else {
          tipRef.current = null; setTip(null);
        }
      } else {
        if (tipRef.current) { tipRef.current = null; setTip(null); }
      }

      // ---- HTML labels ----
      const hostRect = host.getBoundingClientRect();
      const toScreen = (x: number, y: number, z: number) => {
        labelV.set(x, y, z).project(camera);
        return { x: (labelV.x * 0.5 + 0.5) * hostRect.width, y: (-labelV.y * 0.5 + 0.5) * hostRect.height, behind: labelV.z > 1 };
      };

      // district names — all at state level, only the selected ones when filtering
      for (const name in districtLabels) {
        const el = districtLabels[name];
        const isSel = selSet ? selSet.has(name) : true;
        if (!isSel) { if (el.style.opacity !== "0") el.style.opacity = "0"; continue; }
        const { lng, lat } = districtCentroid(name);
        const [wx, wz] = projectLngLat(lng, lat);
        const p = toScreen(wx, DEPTH + 7, wz);
        if (p.behind) { el.style.opacity = "0"; continue; }
        el.style.transform = `translate(-50%,-50%) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
        const focused = pinDistrict === name;
        el.style.opacity = focused ? "0.98" : "0.62";
        el.style.color = focused ? "#ffc078" : "rgba(226,236,255,.72)";
        el.style.fontSize = focused ? "13px" : "10px";
      }

      // pincode labels — only for the focused (single) district, when zoomed in
      if (pinDistrict !== lastLabelActive) {
        if (lastLabelActive && pinLabels[lastLabelActive]) pinLabels[lastLabelActive].forEach((e) => (e.style.opacity = "0"));
        lastLabelActive = pinDistrict;
      }
      if (pinDistrict) {
        const row = live.current.districts.find((r) => r.district === pinDistrict);
        const arr = pinLabels[pinDistrict];
        if (row && arr) {
          // Large districts show a sparse set of labels; tiny city districts
          // (e.g. Chennai) show pin points only, with the label on hover/select.
          const rr = districtRadius(pinDistrict);
          const labelEvery = rr >= 0.15 ? Math.max(1, Math.ceil(arr.length / 8)) : 0;
          const hoverPin = (hoveredPin?.userData as { pincode?: string } | undefined)?.pincode;
          for (let i = 0; i < arr.length; i++) {
            const pc = row.pincodes[i];
            if (!pc || !zoomedIn) { arr[i].style.opacity = "0"; continue; }
            const selected = pin === pc.pincode;
            const hoveredThis = hoverPin === pc.pincode;
            const show = selected || hoveredThis || (labelEvery > 0 && i % labelEvery === 0);
            if (!show) { arr[i].style.opacity = "0"; continue; }
            const [wx, wz] = projectLngLat(pc.lng, pc.lat);
            const p = toScreen(wx, DEPTH + 9, wz);
            if (p.behind) { arr[i].style.opacity = "0"; continue; }
            const dy = selected ? "-150%" : i % 2 === 0 ? "-160%" : "55%";
            arr[i].style.transform = `translate(-50%,${dy}) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
            arr[i].style.opacity = selected ? "1" : hoveredThis ? "0.95" : "0.7";
            arr[i].style.color = selected || hoveredThis ? "#ffffff" : "rgba(255,255,255,.8)";
            arr[i].style.background = selected ? "rgba(217,96,10,.85)" : "rgba(5,11,31,.72)";
          }
        }
      }

      renderer.render(scene, camera);
    };
    const stop = rafLoop(frame);
    setReady(true);

    apiRef.current = {
      rebuildMarkers,
      setSelection,
      reset: () => {
        theta = 0.12; phi = 0.86; dist = 1850;
        desired.tx = 0; desired.tz = 0; desired.dist = 1850;
      },
    };

    return () => {
      stop();
      ro.disconnect();
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

  // rebuild survey markers when the poll type / district data changes
  useEffect(() => {
    apiRef.current?.rebuildMarkers();
  }, [pollType, pollData]);

  // camera framing whenever the district selection changes
  useEffect(() => {
    apiRef.current?.setSelection(selectedDistricts);
  }, [selectedDistricts]);

  return (
    <div ref={hostRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" aria-label="3D map of Tamil Nadu districts with survey points" role="img" />
      <div ref={labelRef} className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden />

      {/* loading veil */}
      {!ready && (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/45">Loading Tamil Nadu…</div>
      )}

      {/* legend */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-10">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Survey nodes</p>
        <div className="flex items-center gap-2 text-[10px] text-white/45">
          <span className="size-2.5 rounded-full border border-white/60" />
          <span>Pincode · size = samples</span>
        </div>
        <p className="mt-1 text-[10px] text-white/30">Select a district to reveal its pincodes</p>
      </div>

      {/* reset camera */}
      <button
        type="button"
        onClick={() => apiRef.current?.reset()}
        aria-label="Reset map view"
        className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 backdrop-blur-xl transition hover:border-white/25 hover:text-white focus-visible:ring-2 focus-visible:ring-saffron/60 focus-visible:outline-none"
      >
        <RotateCcw className="size-4" />
      </button>

      <p className="pointer-events-none absolute bottom-4 right-4 z-10 hidden text-[10.5px] uppercase tracking-[0.14em] text-white/30 sm:block">
        Drag to rotate · Scroll to zoom · Click a district
      </p>

      {tip && tipRef.current && <MapTooltip data={tip} x={tipRef.current.x} y={tipRef.current.y} />}
    </div>
  );
}
