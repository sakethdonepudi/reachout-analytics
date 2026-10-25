"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { geoIdentity } from "d3-geo";
import AC_GEO from "@/lib/data/tamil-nadu/tn-acs.json";
import DISTRICT_GEO from "@/lib/data/tamil-nadu/tn-districts.json";
import {
  TN_COLOR, TN_LABEL, TN_NO_DATA, tnLeader, tnPct,
  type TnAc, type TnDistrict, type TnYearOrCurrent,
} from "@/lib/tamil-nadu/model";

export type MapTheme = "light" | "dark";
export type MapMode = "state" | "district" | "pincode";

const BOX = 1000;
const DEPTH = 10;
const AC_DEPTH = 3;
const CX = BOX / 2;
const CZ = BOX / 2;

type AcFeature = { type: "Feature"; properties: { no: number; name: string; district: string; centroid?: [number, number] }; geometry: { type: string; coordinates: unknown } };
type DistrictFeature = { type: "Feature"; properties: { district: string; centroid?: [number, number] }; geometry: { type: string; coordinates: unknown } };
type FC = { type: "FeatureCollection"; features: AcFeature[] };
type DFC = { type: "FeatureCollection"; features: DistrictFeature[] };
const AC_FC = AC_GEO as unknown as FC;
const D_FC = DISTRICT_GEO as unknown as DFC;

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
  dark: { none: "#2b3442", side: "#1c2531", line: "rgba(205,215,228,.55)", sel: "#ffffff", label: "#e8edf4", halo: "rgba(6,10,18,.88)", bg: "rgba(16,22,30,.97)", border: "rgba(120,135,155,.35)" },
  light: { none: "#e7ebef", side: "#d3d9e0", line: "rgba(60,78,96,.55)", sel: "#1f2937", label: "#1b2430", halo: "rgba(255,255,255,.94)", bg: "rgba(255,255,255,.98)", border: "rgba(20,24,31,.14)" },
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
function groupColorForAc(a: TnAc | undefined, year: TnYearOrCurrent): { color: string; share: number; group: string | null; count: number } {
  if (!a) return { color: TN_NO_DATA, share: 0, group: null, count: 0 };
  if (year === "2026") {
    const g = a.surveyLeader;
    return { color: g ? TN_COLOR[g] : TN_NO_DATA, share: g ? a.survey.shares?.[g] ?? 0 : 0, group: g, count: a.survey.valid };
  }
  const rec = a.actual[year];
  const g = rec.winner;
  return { color: g ? TN_COLOR[g] : TN_NO_DATA, share: g ? rec.shares?.[g] ?? 0 : 0, group: g, count: rec.available ? 1 : 0 };
}
function groupColorForDistrict(d: TnDistrict | undefined, year: TnYearOrCurrent): { color: string; share: number; group: string | null; count: number } {
  if (!d) return { color: TN_NO_DATA, share: 0, group: null, count: 0 };
  if (year === "2026") {
    const g = tnLeader(d.survey.shares);
    return { color: g ? TN_COLOR[g] : TN_NO_DATA, share: g ? d.survey.shares?.[g] ?? 0 : 0, group: g, count: d.survey.valid };
  }
  const rec = d.actual[year];
  const g = tnLeader(rec.shares);
  return { color: g ? TN_COLOR[g] : TN_NO_DATA, share: g ? rec.shares?.[g] ?? 0 : 0, group: g, count: rec.available ? 1 : 0 };
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
    let desired = { tx: 0, tz: 0, dist: 2050 };
    const projection = geoIdentity().reflectY(true).fitExtent([[70, 70], [BOX - 70, BOX - 70]], D_FC as never);
    const project = (p: [number, number]) => {
      const q = projection(p);
      return q ? ([q[0], q[1]] as [number, number]) : ([0, 0] as [number, number]);
    };

    type Unit = {
      group: THREE.Group; mesh: THREE.Mesh; cap: THREE.MeshStandardMaterial; side: THREE.MeshStandardMaterial;
      line: THREE.LineBasicMaterial; bounds: { minx: number; maxx: number; minz: number; maxz: number };
      label: HTMLSpanElement; name: string; kind: "district" | "ac"; key: string; no?: number;
    };
    const districtsUnits = new Map<string, Unit>();
    const acUnits = new Map<number, Unit>();
    const acLayer = new Map<string, THREE.Group>();
    const pickables: THREE.Mesh[] = [];
    const labelEls: Unit[] = [];
    const makeLabel = (text: string, kind: "district" | "ac") => {
      const el = document.createElement("span");
      el.textContent = text;
      el.style.position = "absolute"; el.style.pointerEvents = "none"; el.style.transform = "translate(-50%,-50%)";
      el.style.whiteSpace = "nowrap"; el.style.fontFamily = "inherit"; el.style.fontWeight = kind === "district" ? "600" : "500";
      el.style.fontSize = kind === "district" ? "10px" : "8px"; el.style.zIndex = kind === "district" ? "4" : "3";
      el.style.color = P.label; el.style.textShadow = `0 0 3px ${P.halo}, 0 0 2px ${P.halo}`;
      el.style.transition = reduced ? "none" : "opacity .25s ease";
      labelRoot.appendChild(el);
      return el;
    };
    const addFeature = (f: AcFeature | DistrictFeature, kind: "district" | "ac") => {
      const shapes = shapeFor(f, project);
      if (!shapes.length) return null;
      const geo = new THREE.ExtrudeGeometry(shapes, { depth: kind === "district" ? DEPTH : AC_DEPTH, bevelEnabled: false, curveSegments: 1 });
      geo.rotateX(Math.PI / 2);
      geo.translate(0, kind === "district" ? DEPTH : DEPTH + 1, 0);
      const cap = new THREE.MeshStandardMaterial({ color: P.none, roughness: 0.95, metalness: 0.03, side: THREE.DoubleSide });
      const side = new THREE.MeshStandardMaterial({ color: P.side, roughness: 1, metalness: 0.02, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, [cap, side]);
      mesh.userData.kind = kind;
      if (kind === "district") mesh.userData.district = f.properties.district;
      else { mesh.userData.no = (f as AcFeature).properties.no; mesh.userData.district = (f as AcFeature).properties.district; }
      mesh.castShadow = true; mesh.receiveShadow = true;
      pickables.push(mesh);
      const g = new THREE.Group(); g.add(mesh);
      const pts: number[] = [];
      const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
      let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
      for (const poly of polys) for (const ring of poly) {
        for (let i = 0; i < ring.length; i++) {
          const p = project([ring[i][0], ring[i][1]]);
          const q = project([ring[(i + 1) % ring.length][0], ring[(i + 1) % ring.length][1]]);
          const px = p[0] - CX, pz = p[1] - CZ;
          minx = Math.min(minx, px); maxx = Math.max(maxx, px); minz = Math.min(minz, pz); maxz = Math.max(maxz, pz);
          pts.push(px, (kind === "district" ? DEPTH : DEPTH + AC_DEPTH) + 0.08, pz, q[0] - CX, (kind === "district" ? DEPTH : DEPTH + AC_DEPTH) + 0.08, q[1] - CZ);
        }
      }
      const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const line = new THREE.LineBasicMaterial({ color: P.line, transparent: true, opacity: kind === "district" ? 0.9 : 0.62 });
      g.add(new THREE.LineSegments(lineGeo, line));
      const centroid = (f.properties as { centroid?: [number, number] }).centroid ?? [78.5, 11];
      const c = project(centroid);
      const label = makeLabel(kind === "district" ? (f.properties as { district: string }).district : (f as AcFeature).properties.name, kind);
      const unit: Unit = { group: g, mesh, cap, side, line, bounds: { minx, maxx, minz, maxz }, label, name: kind === "district" ? (f.properties as DistrictFeature["properties"]).district : (f as AcFeature).properties.name, kind, key: kind === "district" ? "d:" + (f.properties as DistrictFeature["properties"]).district : "a:" + (f as AcFeature).properties.no, no: kind === "ac" ? (f as AcFeature).properties.no : undefined };
      label.dataset.cx = String(c[0] - CX); label.dataset.cz = String(c[1] - CZ);
      labelEls.push(unit);
      return unit;
    };
    for (const f of D_FC.features) {
      const u = addFeature(f, "district");
      if (!u) continue;
      districtsUnits.set(f.properties.district, u);
      const layer = new THREE.Group(); layer.visible = false; u.group.add(layer); acLayer.set(f.properties.district, layer);
      mapGroup.add(u.group);
    }
    for (const f of AC_FC.features) {
      const layer = acLayer.get(f.properties.district);
      if (!layer) continue;
      const u = addFeature(f, "ac");
      if (!u) continue;
      acUnits.set(f.properties.no, u);
      layer.add(u.group);
    }
    apiRef.current = {
      setSelection: (d, a, y) => {
        const activeD = d ? districtsUnits.get(d) : null;
        const activeAC = a != null ? acUnits.get(a) : null;
        const mobileState = typeof window !== "undefined" && window.innerWidth < 640;
        const mobileLabels = new Set([...districtsUnits.keys()].sort((aKey, bKey) => (districtRef.current.get(bKey)?.survey.valid ?? 0) - (districtRef.current.get(aKey)?.survey.valid ?? 0)).slice(0, 10));
        for (const [name, u] of districtsUnits) {
          const selected = !!activeD && name === activeD.name;
          u.group.visible = activeD ? selected : true;
          const acLayerGroup = acLayer.get(name); if (acLayerGroup) acLayerGroup.visible = selected;
          const info = groupColorForDistrict(districtRef.current.get(name), y);
          u.cap.color.set(info.color);
          u.side.color.set(info.color);
          u.line.color.set(selected ? P.sel : P.line);
          u.line.opacity = selected ? 1 : 0.9;
          u.mesh.position.y = selected ? 12 : 0;
          u.label.style.opacity = activeD ? (selected ? "1" : "0") : (mobileState && !mobileLabels.has(name) ? "0" : "1");
          u.label.style.fontSize = selected ? "12px" : "10px";
        }
        for (const [no, u] of acUnits) {
          const info = groupColorForAc(acRef.current.get(no), y);
          const acSelected = !!activeAC && no === activeAC.no;
          u.cap.color.set(acSelected ? new THREE.Color(info.color).offsetHSL(0, 0, 0.16) : info.color);
          u.cap.emissive.set(acSelected ? info.color : "#000000");
          u.cap.emissiveIntensity = acSelected ? 0.55 : 0;
          u.side.color.set(acSelected ? new THREE.Color(info.color).offsetHSL(0, 0, 0.1) : info.color);
          const inSelectedDistrict = !!activeD && u.mesh.userData.district === activeD.name;
          u.group.visible = inSelectedDistrict;
          u.mesh.position.y = activeAC && no === activeAC.no ? 14 : 2;
          u.line.color.set(activeAC && no === activeAC.no ? P.sel : info.color);
          u.line.opacity = activeAC && no === activeAC.no ? 1 : 0.35;
          u.label.style.opacity = inSelectedDistrict ? "1" : "0";
          u.label.style.fontSize = activeAC && no === activeAC.no ? "10px" : "8px";
        }
        // Camera
        let bounds: { minx: number; maxx: number; minz: number; maxz: number } | null = null;
        if (activeD) bounds = activeD.bounds;
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
          const fit = Math.max((H / 2) / Math.tan(fov / 2), (W / 2) / Math.tan(Math.atan(Math.tan(fov / 2) * (availW / availH)))) * (activeAC ? 1.3 : 1.45);
          dist = Math.max(90, Math.min(3300, fit));
          const shift = wide ? -70 : 0;
          const worldPerPx = (2 * dist * Math.tan(fov / 2)) / availH;
          centerX += shift * worldPerPx;
        }
        desired.tx = centerX; desired.tz = centerZ; desired.dist = dist;
      },
      resetCamera: () => { desired.tx = 0; desired.tz = 0; desired.dist = 2050; },
    };
    apiRef.current?.setSelection(live.current.district, live.current.acNo, live.current.year);
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
      // Label screen placement
      const rect = host.getBoundingClientRect();
      for (const u of labelEls) {
        if (u.label.style.opacity === "0") continue;
        const x = Number(u.label.dataset.cx || 0), z = Number(u.label.dataset.cz || 0);
        const p = new THREE.Vector3(x, u.kind === "district" ? DEPTH : DEPTH + AC_DEPTH, z).project(camera);
        const sx = (p.x * 0.5 + 0.5) * rect.width, sy = (-p.y * 0.5 + 0.5) * rect.height;
        u.label.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-50%)`;
      }
      renderer.render(scene, camera);
      if (!disposed) raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    const onPointerMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1; ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
        theta = Math.max(-0.6, Math.min(0.6, -dx * 0.004)); phi = Math.max(0.25, Math.min(1.1, 0.58 + dy * 0.003));
        drag.x = e.clientX; drag.y = e.clientY; return;
      }
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(pickables, false).filter((h) => h.object.visible && h.object.parent?.visible !== false);
      const hit = hits.find((h) => h.object.userData.kind === "ac" && live.current.district != null) ?? hits.find((h) => h.object.userData.kind === "district");
      if (hit) {
        const data = hit.object.userData; const kind = data.kind as "district" | "ac";
        const key = kind === "district" ? "d:" + data.district : "a:" + data.no;
        if (key !== hoveredKey) {
          hoveredKey = key; canvas.style.cursor = "pointer";
          if (kind === "district") {
            const info = groupColorForDistrict(districtRef.current.get(data.district), live.current.year);
            setTip({ x: e.clientX, y: e.clientY, title: data.district, sub: live.current.year === "2026" ? "2026 adjusted survey leader" : `${live.current.year} group leader`, value: `${info.group ?? "No data"} · ${tnPct(info.share)} · ${info.count.toLocaleString("en-IN")}`, color: info.color });
          } else {
            const a = acRef.current.get(data.no); const info = groupColorForAc(a, live.current.year);
            setTip({ x: e.clientX, y: e.clientY, title: a?.name ?? `AC ${data.no}`, sub: `${data.district} · ${live.current.year === "2026" ? "adjusted survey" : live.current.year}`, value: `${info.group ?? "No data"} · ${tnPct(info.share)} · ${info.count.toLocaleString("en-IN")}`, color: info.color });
          }
        } else setTip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : t);
      } else { hoveredKey = null; canvas.style.cursor = "grab"; setTip(null); }
    };
    const onPointerDown = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing"; };
    const onPointerUp = (e: PointerEvent) => {
      const wasDrag = drag?.moved; drag = null; canvas.style.cursor = "grab";
      if (wasDrag) return;
      const r = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1; ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(pickables, false).filter((h) => h.object.visible);
      const hit = hits.find((h) => h.object.userData.kind === "ac" && live.current.district != null) ?? hits.find((h) => h.object.userData.kind === "district");
      if (!hit) { live.current.onReset(); return; }
      if (hit.object.userData.kind === "district") live.current.onSelectDistrict(hit.object.userData.district as string);
      else live.current.onSelectAc(hit.object.userData.no as number);
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); desired.dist = Math.max(35, Math.min(3300, desired.dist * (1 + e.deltaY * 0.0012))); };
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
