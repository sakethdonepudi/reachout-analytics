"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { geoIdentity } from "d3-geo";
import DISTRICT_GEO from "@/lib/data/tamil-nadu/tn-districts.json";
import {
  TN_COLOR, TN_NO_DATA, tnLeader, tnPct,
  type TnDistrict, type TnYearOrCurrent,
} from "@/lib/tamil-nadu/model";

export type MapTheme = "light" | "dark";
export type MapMode = "state" | "district";

const BOX = 1000;
const DEPTH = 10;
const CX = BOX / 2;
const CZ = BOX / 2;
const DISTRICT_ALIAS: Record<string, string> = {
  Kanyakumari: "Kanniyakumari",
  Nilgiris: "The Nilgiris",
  Thiruvarur: "Tiruvarur",
  Thoothukkudi: "Thoothukudi",
  Viluppuram: "Villupuram",
};
const canonicalDistrict = (name: string) => DISTRICT_ALIAS[name] ?? name;

type DistrictFeature = { type: "Feature"; properties: { district: string; centroid?: [number, number] }; geometry: { type: string; coordinates: unknown } };
type DFC = { type: "FeatureCollection"; features: DistrictFeature[] };
const D_FC = DISTRICT_GEO as unknown as DFC;

type Props = {
  districts: TnDistrict[];
  district: string | null;
  year: TnYearOrCurrent;
  theme: MapTheme;
  onSelectDistrict: (name: string) => void;
  onReset: () => void;
};

const PAL = {
  dark: { none: "#2b3442", side: "#1c2531", line: "rgba(205,215,228,.55)", sel: "#ffffff", label: "#e8edf4", halo: "rgba(6,10,18,.88)", bg: "rgba(16,22,30,.97)", border: "rgba(120,135,155,.35)" },
  light: { none: "#e7ebef", side: "#d3d9e0", line: "rgba(60,78,96,.55)", sel: "#1f2937", label: "#1b2430", halo: "rgba(255,255,255,.94)", bg: "rgba(255,255,255,.98)", border: "rgba(20,24,31,.14)" },
};
const shade = (hex: string, amount: number) => {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(0.22, Math.min(0.68, hsl.l + amount)));
};
function shapeFor(feature: DistrictFeature, project: (p: [number, number]) => [number, number]): THREE.Shape[] {
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
function districtColor(d: TnDistrict | undefined, year: TnYearOrCurrent): { color: string; share: number; group: string | null; count: number } {
  if (!d) return { color: TN_NO_DATA, share: 0, group: null, count: 0 };
  if (year === "2026") {
    const g = d.combined.leader;
    return { color: g ? TN_COLOR[g] : TN_NO_DATA, share: g ? d.combined.shares?.[g] ?? 0 : 0, group: g, count: d.combined.valid };
  }
  const rec = d.actual[year];
  const g = tnLeader(rec.shares);
  return { color: g ? TN_COLOR[g] : TN_NO_DATA, share: g ? rec.shares?.[g] ?? 0 : 0, group: g, count: rec.available ? 1 : 0 };
}

export default function TamilNaduMap({ districts, district, year, theme, onSelectDistrict, onReset }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; title: string; sub: string; value: string; color: string } | null>(null);
  const live = useRef({ districts, district, year, theme, onSelectDistrict, onReset });
  live.current = { districts, district, year, theme, onSelectDistrict, onReset };
  const districtByName = useMemo(() => new Map(districts.map((d) => [d.name, d])), [districts]);
  const districtRef = useRef(districtByName); districtRef.current = districtByName;
  const apiRef = useRef<{
    setSelection: (d: string | null, y: TnYearOrCurrent) => void;
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
    let desired = { tx: 0, tz: 0, dist: 2050 };
    const projection = geoIdentity().reflectY(true).fitExtent([[70, 70], [BOX - 70, BOX - 70]], D_FC as never);
    const project = (p: [number, number]) => {
      const q = projection(p);
      return q ? ([q[0], q[1]] as [number, number]) : ([0, 0] as [number, number]);
    };

    type Unit = {
      group: THREE.Group; mesh: THREE.Mesh; cap: THREE.MeshStandardMaterial; side: THREE.MeshStandardMaterial;
      line: THREE.LineBasicMaterial; bounds: { minx: number; maxx: number; minz: number; maxz: number };
      label: HTMLSpanElement; name: string; key: string;
    };
    const units = new Map<string, Unit>();
    const pickables: THREE.Mesh[] = [];
    const labelEls: Unit[] = [];
    const makeLabel = (text: string) => {
      const el = document.createElement("span");
      el.textContent = text;
      el.style.position = "absolute"; el.style.pointerEvents = "none"; el.style.transform = "translate(-50%,-50%)";
      el.style.whiteSpace = "nowrap"; el.style.fontFamily = "inherit"; el.style.fontWeight = "600";
      el.style.fontSize = "10px"; el.style.zIndex = "4";
      el.style.color = P.label; el.style.textShadow = `0 0 3px ${P.halo}, 0 0 2px ${P.halo}`;
      el.style.transition = reduced ? "none" : "opacity .25s ease";
      labelRoot.appendChild(el);
      return el;
    };
    for (const f of D_FC.features) {
      const key = canonicalDistrict(f.properties.district);
      const shapes = shapeFor(f, project);
      if (!shapes.length) continue;
      const geo = new THREE.ExtrudeGeometry(shapes, { depth: DEPTH, bevelEnabled: false, curveSegments: 1 });
      geo.rotateX(Math.PI / 2);
      geo.translate(0, DEPTH, 0);
      const cap = new THREE.MeshStandardMaterial({ color: P.none, roughness: 0.95, metalness: 0.03, side: THREE.DoubleSide });
      const side = new THREE.MeshStandardMaterial({ color: P.side, roughness: 1, metalness: 0.02, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, [cap, side]);
      mesh.userData.district = key;
      mesh.castShadow = true; mesh.receiveShadow = true;
      pickables.push(mesh);
      const group = new THREE.Group(); group.add(mesh);
      const pts: number[] = [];
      const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
      let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
      for (const poly of polys) for (const ring of poly) {
        for (let i = 0; i < ring.length; i++) {
          const p = project([ring[i][0], ring[i][1]]);
          const q = project([ring[(i + 1) % ring.length][0], ring[(i + 1) % ring.length][1]]);
          const px = p[0] - CX, pz = p[1] - CZ;
          minx = Math.min(minx, px); maxx = Math.max(maxx, px); minz = Math.min(minz, pz); maxz = Math.max(maxz, pz);
          pts.push(px, DEPTH + 0.08, pz, q[0] - CX, DEPTH + 0.08, q[1] - CZ);
        }
      }
      const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const line = new THREE.LineBasicMaterial({ color: P.line, transparent: true, opacity: 0.9 });
      group.add(new THREE.LineSegments(lineGeo, line));
      const centroid = f.properties.centroid ?? [78.5, 11];
      const c = project(centroid);
      const label = makeLabel(key);
      label.dataset.cx = String(c[0] - CX); label.dataset.cz = String(c[1] - CZ);
      const unit: Unit = { group, mesh, cap, side, line, bounds: { minx, maxx, minz, maxz }, label, name: key, key };
      units.set(key, unit);
      labelEls.push(unit);
      mapGroup.add(group);
    }

    apiRef.current = {
      setSelection: (d, y) => {
        const activeName = d ? canonicalDistrict(d) : null;
        const active = activeName ? units.get(activeName) : null;
        const mobile = typeof window !== "undefined" && window.innerWidth < 640;
        const mobileLabels = new Set([...units.keys()].sort((a, b) => (districtRef.current.get(b)?.combined.valid ?? 0) - (districtRef.current.get(a)?.combined.valid ?? 0)).slice(0, 10));
        for (const [name, u] of units) {
          const selected = !!active && name === active.name;
          u.group.visible = active ? selected : true;
          const info = districtColor(districtRef.current.get(name), y);
          u.cap.color.set(info.color);
          u.side.color.set(info.color);
          u.line.color.set(selected ? P.sel : P.line);
          u.line.opacity = selected ? 1 : 0.9;
          u.mesh.position.y = selected ? 12 : 0;
          u.label.style.opacity = active ? (selected ? "1" : "0") : (mobile && !mobileLabels.has(name) ? "0" : "1");
          u.label.style.fontSize = selected ? "12px" : "10px";
          u.cap.needsUpdate = true; u.side.needsUpdate = true; u.line.needsUpdate = true;
        }
        let bounds: Unit["bounds"] | null = null;
        if (active) bounds = active.bounds;
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
          const fit = Math.max((H / 2) / Math.tan(fov / 2), (W / 2) / Math.tan(Math.atan(Math.tan(fov / 2) * (availW / availH)))) * 1.35;
          dist = Math.max(90, Math.min(3300, fit));
          const shift = wide ? -70 : 0;
          const worldPerPx = (2 * dist * Math.tan(fov / 2)) / availH;
          centerX += shift * worldPerPx;
        }
        desired.tx = centerX; desired.tz = centerZ; desired.dist = dist;
      },
      resetCamera: () => { desired.tx = 0; desired.tz = 0; desired.dist = 2050; },
    };
    apiRef.current?.setSelection(live.current.district, live.current.year);
    setReady(true);

    let targetX = desired.tx, targetZ = desired.tz, targetDist = desired.dist;
    let theta = 0, phi = 0.58;
    let raf = 0, disposed = false, hoveredKey: string | null = null;
    let drag: { x: number; y: number; moved: boolean } | null = null;
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
    const updateCamera = () => {
      if (!reduced) {
        targetX += (desired.tx - targetX) * 0.08; targetZ += (desired.tz - targetZ) * 0.08; targetDist += (desired.dist - targetDist) * 0.08;
        theta += (0 - theta) * 0.04; phi += (0.58 - phi) * 0.04;
      } else { targetX = desired.tx; targetZ = desired.tz; targetDist = desired.dist; theta = 0; phi = 0.58; }
      camera.position.set(targetX + targetDist * Math.sin(phi) * Math.sin(theta), targetDist * Math.cos(phi), targetZ + targetDist * Math.sin(phi) * Math.cos(theta));
      camera.lookAt(targetX, 0, targetZ);
    };
    const resize = () => {
      const r = host.getBoundingClientRect(); renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
      camera.aspect = Math.max(0.2, r.width / Math.max(1, r.height)); camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(host);
    const render = () => {
      updateCamera();
      const rect = host.getBoundingClientRect();
      for (const u of labelEls) {
        if (u.label.style.opacity === "0") continue;
        const x = Number(u.label.dataset.cx || 0), z = Number(u.label.dataset.cz || 0);
        const p = new THREE.Vector3(x, DEPTH, z).project(camera);
        const sx = (p.x * 0.5 + 0.5) * rect.width, sy = (-p.y * 0.5 + 0.5) * rect.height;
        u.label.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-50%)`;
      }
      renderer.render(scene, camera);
      if (!disposed) raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    const pickDistrict = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1; ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(pickables, false).filter((h) => h.object.visible && h.object.parent?.visible !== false);
      return hits[0]?.object.userData.district as string | undefined;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
        theta = Math.max(-0.6, Math.min(0.6, -dx * 0.004)); phi = Math.max(0.25, Math.min(1.1, 0.58 + dy * 0.003));
        drag.x = e.clientX; drag.y = e.clientY; return;
      }
      const name = pickDistrict(e);
      if (name) {
        if (name !== hoveredKey) {
          hoveredKey = name; canvas.style.cursor = "pointer";
          const info = districtColor(districtRef.current.get(name), live.current.year);
          setTip({ x: e.clientX, y: e.clientY, title: name, sub: live.current.year === "2026" ? "2026 combined district share" : `${live.current.year} district share`, value: `${info.group ?? "No data"} · ${tnPct(info.share)} · ${info.count.toLocaleString("en-IN")}`, color: info.color });
        } else setTip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : t);
      } else { hoveredKey = null; canvas.style.cursor = "grab"; setTip(null); }
    };
    const onPointerDown = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing"; };
    const onPointerUp = (e: PointerEvent) => {
      const wasDrag = drag?.moved; drag = null; canvas.style.cursor = "grab";
      if (wasDrag) return;
      const name = pickDistrict(e);
      if (!name) { live.current.onReset(); return; }
      live.current.onSelectDistrict(canonicalDistrict(name));
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); desired.dist = Math.max(90, Math.min(3300, desired.dist * (1 + e.deltaY * 0.0012))); };
    const onLeave = () => { hoveredKey = null; setTip(null); drag = null; };
    canvas.addEventListener("pointermove", onPointerMove); canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp); canvas.addEventListener("pointerleave", onLeave); canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove); canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp); canvas.removeEventListener("pointerleave", onLeave); canvas.removeEventListener("wheel", onWheel);
      labelRoot.innerHTML = ""; renderer.dispose();
    };
  }, [theme]);

  useEffect(() => {
    if (!ready) return;
    apiRef.current?.setSelection(district, year);
  }, [ready, district, year, districts]);

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block h-full w-full touch-none" aria-label="3D map of Tamil Nadu districts" role="img" />
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
