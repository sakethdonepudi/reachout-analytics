"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { geoIdentity } from "d3-geo";
import { rafLoop } from "@/lib/raf-loop";
import { PARTY_COLOR, PARTY_LABEL, NO_DATA_COLOR, fmtPct, leaderOf, partyShade, type AcRow, type Party } from "@/lib/telangana/oct26";
import { DEVICE_AC, historicalAc, winnerColour, winnerLabel, winnerShade, type ElectionYear } from "@/lib/telangana/history";
import { brandMarker } from "@/lib/telangana/brands";

/* =====================================================================
   Telangana 2.5D map — October workbook.

   Genuine extruded geometry, perspective camera (34°, φ 0.6), the same
   lighting rig and ~700 ms elapsed-time easing as Tamil Nadu. Each assembly
   is filled by its leading 2028 prediction party, with a party-hue light-to-
   dark shade for that party's predicted share. Ties are split equally
   between the tied parties' colours; missing predictions are neutral grey.
   The compact 2028 prediction is four-group. AIMIM remains a separate series
   in the expanded round tracker and in detailed historical results, not in
   the compact workbook prediction.
   District grouping is the workbook's analytical AC grouping, not an
   official administrative boundary.
   ===================================================================== */

export type MapTheme = "light" | "dark";

const BOX = 1000;
const DEPTH = 10;

type Feature = {
  type: "Feature";
  properties: { acNo: number; name: string; group: string };
  geometry: { type: string; coordinates: unknown };
};
type FC = { type: "FeatureCollection"; features: Feature[] };
type DistrictFeature = { properties: { group: string; acs: number[] }; geometry: { type: string; coordinates: unknown } };
type DistrictFC = { type: "FeatureCollection"; features: DistrictFeature[] };

type Props = {
  acs: AcRow[];
  district: string | null;
  ac: number | null;
  year: ElectionYear;
  layer: "party" | "device";
  theme: "light" | "dark";
  onSelectDistrict: (name: string) => void;
  onSelectAc: (no: number) => void;
  onReset: () => void;
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
type MarkerDef = {
  key: string; level: "district" | "ac" | "brand"; brand: string;
  entries: number; share: number; title: string;
  x: number; z: number; no: number | null; district: string | null;
};
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
const signedArea = (r: number[][]) => {
  let a = 0;
  for (let i = 0, n = r.length; i < n; i++) {
    const p = r[i], q = r[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
};

const PAL = {
  dark: { none: "#2b3442", side: "#1c2531", line: "rgb(190,202,218)", sel: "#ffffff", label: "#e8edf4", halo: "rgba(6,10,18,.86)" },
  light: { none: "#e7ebef", side: "#d3d9e0", line: "rgb(70,86,104)", sel: "#7a1f4d", label: "#1b2430", halo: "rgba(255,255,255,.94)" },
};

/** Equal-width party bands for a tied assembly, mapped once across the cap. */
function tieTexture(colors: string[]): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const band = size / colors.length;
  colors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(i * band), 0, Math.ceil(band) + 1, size);
    if (i > 0) {
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.fillRect(Math.round(i * band) - 0.5, 0, 1, size);
    }
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export default function TelanganaMap({ acs, district, ac, year, layer, theme, onSelectDistrict, onSelectAc, onReset }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const [markers, setMarkers] = useState<MarkerDef[]>([]);
  const markerDefsRef = useRef(new Map<string, MarkerDef>());
  markerDefsRef.current = new Map(markers.map((m) => [m.key, m]));
  const buildMarkersRef = useRef<() => void>(() => {});
  const [geo, setGeo] = useState<FC | null>(null);
  const [districtGeo, setDistrictGeo] = useState<DistrictFC | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; title: string; sub: string; value: string; colours: string[] } | null>(null);

  const live = useRef({ acs, district, ac, year, layer, theme, onSelectDistrict, onSelectAc, onReset });
  live.current = { acs, district, ac, year, layer, theme, onSelectDistrict, onSelectAc, onReset };
  const acByNo = useMemo(() => new Map(acs.map((a) => [a.no, a])), [acs]);
  const acRef = useRef(acByNo);
  acRef.current = acByNo;

  useEffect(() => { setTip(null); }, [year]);

  useEffect(() => {
    buildMarkersRef.current();
  }, [layer, district, ac, acs]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/telangana/telangana-ac.geojson").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      fetch("/telangana/telangana-districts.geojson").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
    ])
      .then(([a, d]: [FC, DistrictFC]) => { if (!cancelled) { setGeo(a); setDistrictGeo(d); } })
      .catch(() => { if (!cancelled) { setGeo(null); setDistrictGeo(null); } });
    return () => { cancelled = true; };
  }, []);

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
      return p ? [p[0] - BOX / 2, p[1] - BOX / 2] : [0, 0];
    };

    type Entry = {
      no: number; district: string;
      group3: THREE.Group; mesh: THREE.Mesh;
      cap: THREE.MeshStandardMaterial; side: THREE.MeshStandardMaterial; line: THREE.LineBasicMaterial;
      fills: Record<ElectionYear, { color: THREE.Color; texture: THREE.CanvasTexture | null }>;
      heat: number; hover: number; isolate: number; dim: number; elev: number;
      bounds: { minx: number; maxx: number; minz: number; maxz: number }; cx: number; cz: number;
    };
    const entries = new Map<number, Entry>();
    const byGroup = new Map<string, number[]>();
    const pickables: THREE.Mesh[] = [];
    const acMap = new Map(live.current.acs.map((a) => [a.no, a]));

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

      const rec = acMap.get(f.properties.acNo);
      const lead = rec ? leaderOf(rec.prediction) : { leader: null, tied: [] as Party[], marginPp: 0 };
      let fillHex = NO_DATA_COLOR;
      let texture: THREE.CanvasTexture | null = null;
      if (rec && rec.answered2028 > 0) {
        if (lead.tied.length > 1) {
          texture = tieTexture(lead.tied.map((p) => partyShade(p, rec.prediction[p])));
          fillHex = "#ffffff";
        } else if (lead.leader) {
          fillHex = partyShade(lead.leader, rec.prediction[lead.leader]);
        }
      }
      const fills: Record<ElectionYear, { color: THREE.Color; texture: THREE.CanvasTexture | null }> = {
        "2028": { color: new THREE.Color(fillHex), texture },
        "2014": { color: new THREE.Color(NO_DATA_COLOR), texture: null },
        "2018": { color: new THREE.Color(NO_DATA_COLOR), texture: null },
        "2023": { color: new THREE.Color(NO_DATA_COLOR), texture: null },
      };
      for (const y of ["2014", "2018", "2023"] as const) {
        const h = historicalAc(y, f.properties.acNo);
        if (h) fills[y] = { color: new THREE.Color(winnerShade(h.winnerParty, h.winnerShare)), texture: null };
      }
      const initial = fills[live.current.year];
      const cap = new THREE.MeshStandardMaterial({ color: new THREE.Color(initial.texture ? "#ffffff" : initial.color), roughness: 0.95, metalness: 0.03, side: THREE.DoubleSide, transparent: true, opacity: 1 });
      const side = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.side), roughness: 1, metalness: 0.02, side: THREE.DoubleSide, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(geom, [cap, side]);
      mesh.userData.acNo = f.properties.acNo;
      pickables.push(mesh);

      const group3 = new THREE.Group();
      group3.add(mesh);

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
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const line = new THREE.LineBasicMaterial({ color: new THREE.Color(P.line), transparent: true, opacity: 0.55 });
      group3.add(new THREE.LineSegments(lg, line));
      scene.add(group3);

      if (texture) {
        /* ExtrudeGeometry UVs follow shape coordinates; normalise them once so
           the tied-party bands span exactly this assembly's cap. */
        const pos = geom.attributes.position;
        const uw = Math.max(1e-6, maxx - minx), uh = Math.max(1e-6, maxz - minz);
        const uv = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
          uv[i * 2] = (pos.getX(i) - minx) / uw;
          uv[i * 2 + 1] = (pos.getZ(i) - minz) / uh;
        }
        geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        if (live.current.year === "2028") {
          cap.map = texture;
          cap.color.set("#ffffff");
          cap.needsUpdate = true;
        }
      }

      entries.set(f.properties.acNo, {
        no: f.properties.acNo, district: f.properties.group, group3, mesh, cap, side, line,
        fills,
        heat: 0, hover: 0, isolate: 0, dim: 0, elev: 0,
        bounds: { minx, maxx, minz, maxz }, cx: (minx + maxx) / 2, cz: (minz + maxz) / 2,
      });
      const arr = byGroup.get(f.properties.group) ?? [];
      arr.push(f.properties.acNo);
      byGroup.set(f.properties.group, arr);
    }

    const stateBox = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (const e of entries.values()) {
      stateBox.minX = Math.min(stateBox.minX, e.bounds.minx); stateBox.maxX = Math.max(stateBox.maxX, e.bounds.maxx);
      stateBox.minZ = Math.min(stateBox.minZ, e.bounds.minz); stateBox.maxZ = Math.max(stateBox.maxZ, e.bounds.maxz);
    }
    const groupCentroid = new Map<string, { x: number; z: number }>();
    const groupArea = new Map<string, number>();
    for (const [g, nos] of byGroup) {
      let x = 0, z = 0, area = 0;
      for (const no of nos) {
        const e = entries.get(no)!;
        x += e.cx; z += e.cz;
        area += (e.bounds.maxx - e.bounds.minx) * (e.bounds.maxz - e.bounds.minz);
      }
      groupCentroid.set(g, { x: x / nos.length, z: z / nos.length });
      groupArea.set(g, area);
    }
    /* on narrow screens only the largest districts keep a label, so the map stays legible */
    const topMobileGroups = new Set(
      [...groupArea.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([g]) => g),
    );

    /* district outlines: the analytical grouping boundaries shown at state */
    const districtLines = new Map<string, THREE.LineBasicMaterial>();
    for (const f of districtGeo.features) {
      const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
      const pts: number[] = [];
      for (const poly of polys) for (const ring of poly) {
        for (let i = 0; i < ring.length; i++) {
          const [px, pz] = project(ring[i][0], ring[i][1]);
          const [qx, qz] = project(ring[(i + 1) % ring.length][0], ring[(i + 1) % ring.length][1]);
          pts.push(px, DEPTH + 1.15, pz, qx, DEPTH + 1.15, qz);
        }
      }
      if (!pts.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(P.line), transparent: true, opacity: 0.75 });
      scene.add(new THREE.LineSegments(g, mat));
      districtLines.set(f.properties.group, mat);
    }

    /* ---------------- deterministic illustrative device anchors ---------------- */
    const acAnchors = new Map<number, { x: number; z: number }[]>();
    for (const f of geo.features) {
      const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
      /* use the largest polygon part so exclaves do not pull anchors off the main shape */
      let poly: number[][][] | null = null;
      let bestArea = -1;
      for (const candidate of polys) {
        const outer = candidate?.[0];
        if (!outer || outer.length < 4) continue;
        let bminx = Infinity, bmaxx = -Infinity, bminz = Infinity, bmaxz = -Infinity;
        for (const [lng, lat] of outer) {
          const [x, z] = project(lng, lat);
          bminx = Math.min(bminx, x); bmaxx = Math.max(bmaxx, x); bminz = Math.min(bminz, z); bmaxz = Math.max(bmaxz, z);
        }
        const area = (bmaxx - bminx) * (bmaxz - bminz);
        if (area > bestArea) { bestArea = area; poly = candidate; }
      }
      if (!poly) continue;
      const outer = poly[0];
      const projected = outer.map(([lng, lat]) => project(lng, lat));
      const holes = poly.slice(1).map((ring) => ring.map(([lng, lat]) => project(lng, lat)));
      let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
      for (const [x, z] of projected) {
        minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z);
      }
      const w = maxx - minx, h = maxz - minz;
      const area = w * h;
      if (!(area > 0)) continue;
      const rnd = mulberry32(f.properties.acNo * 7919 + 17);
      const want = clamp(Math.round(Math.sqrt(area) / 3.2), 2, 12);
      const minGap = Math.max(2.4, Math.min(9, Math.sqrt(area) * 0.3));
      const ringsProj = [projected, ...holes];
      const chosen: { x: number; z: number }[] = [];
      for (let attempt = 0; attempt < want * 90 && chosen.length < want; attempt++) {
        const x = minx + rnd() * w, z = minz + rnd() * h;
        if (!pointInPolygon(x, z, ringsProj)) continue;
        if (chosen.some((c) => Math.hypot(c.x - x, c.z - z) < minGap)) continue;
        chosen.push({ x, z });
      }
      const cx = (minx + maxx) / 2, cz = (minz + maxz) / 2;
      chosen.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz));
      if (chosen.length) acAnchors.set(f.properties.acNo, chosen);
    }

    const buildMarkers = () => {
      const { layer: activeLayer, district: activeDistrict, ac: activeAc, acs: allAcs } = live.current;
      if (activeLayer !== "device") { setMarkers([]); return; }
      const list: MarkerDef[] = [];
      const acMap = new Map(allAcs.map((a) => [a.no, a]));
      if (activeAc != null) {
        const rec = DEVICE_AC(activeAc);
        const anchors = acAnchors.get(activeAc) ?? [];
        if (rec && anchors.length) {
          const top = [...rec.brands].sort((a, b) => b.entries - a.entries).slice(0, Math.min(4, anchors.length));
          top.forEach((b, i) => list.push({
            key: `brand-${activeAc}-${b.brand}`, level: "brand", brand: b.brand,
            entries: b.entries, share: b.share, title: acMap.get(activeAc)?.name ?? `AC ${activeAc}`,
            x: anchors[i].x, z: anchors[i].z, no: activeAc, district: activeDistrict,
          }));
        }
      } else if (activeDistrict) {
        const rows = allAcs.filter((x) => x.district === activeDistrict).map((a) => {
          const rec = DEVICE_AC(a.no);
          const anchors = acAnchors.get(a.no) ?? [];
          const b = rec ? [...rec.brands].sort((x, y) => y.entries - x.entries)[0] : null;
          return rec && anchors.length && b ? { a, rec, anchors, b } : null;
        }).filter((x): x is NonNullable<typeof x> => !!x);
        const chosen = typeof window !== "undefined" && window.innerWidth < 640 ? rows.sort((x, y) => y.rec.total - x.rec.total).slice(0, 10) : rows;
        for (const { a, anchors, b } of chosen) {
          list.push({
            key: `ac-${a.no}`, level: "ac", brand: b.brand, entries: b.entries, share: b.share,
            title: a.name, x: anchors[0].x, z: anchors[0].z, no: a.no, district: activeDistrict,
          });
        }
      } else {
        const districts = [...byGroup.entries()].map(([g, nos]) => {
          let total = 0;
          const totals = new Map<string, number>();
          for (const no of nos) {
            const rec = DEVICE_AC(no);
            if (!rec) continue;
            total += rec.total;
            for (const b of rec.brands) totals.set(b.brand, (totals.get(b.brand) ?? 0) + b.entries);
          }
          const top = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
          const anchor = groupCentroid.get(g);
          return total && top && anchor ? { g, total, top, anchor } : null;
        }).filter((x): x is NonNullable<typeof x> => !!x);
        const chosen = typeof window !== "undefined" && window.innerWidth < 640 ? districts.sort((a, b) => b.total - a.total).slice(0, 8) : districts;
        for (const { g, total, top, anchor } of chosen) {
          list.push({
            key: `g-${g}`, level: "district", brand: top[0], entries: top[1], share: top[1] / total,
            title: g, x: anchor.x, z: anchor.z, no: null, district: g,
          });
        }
      }
      setMarkers(list);
    };
    buildMarkersRef.current = buildMarkers;
    buildMarkers();

    /* ---------------- camera ---------------- */
    let theta = 0, phi = 0.6, dist = 2020;
    const target = new THREE.Vector3(0, 0, 0);
    const desired = { tx: 0, tz: 0, dist: 2020 };
    const applyCamera = () => {
      camera.position.set(target.x + dist * Math.sin(phi) * Math.sin(theta), dist * Math.cos(phi), target.z + dist * Math.sin(phi) * Math.cos(theta));
      camera.lookAt(target);
    };
    const FZ = 0.737;

    const fit = (nos: number[] | null, opts: { margin?: number; min?: number } = {}) => {
      const rect = host.getBoundingClientRect();
      const vw = Math.max(320, rect.width), vh = Math.max(320, rect.height);
      const wide = window.innerWidth > 1024;
      const leftPx = wide ? 300 : 0, rightPx = wide ? 340 : 0;
      const { margin = 1.35, min = 90 } = opts;
      let b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
      for (const e of entries.values()) {
        if (nos && !nos.includes(e.no)) continue;
        b.minX = Math.min(b.minX, e.bounds.minx); b.maxX = Math.max(b.maxX, e.bounds.maxx);
        b.minZ = Math.min(b.minZ, e.bounds.minz); b.maxZ = Math.max(b.maxZ, e.bounds.maxz);
      }
      if (!Number.isFinite(b.minX)) b = stateBox;
      const bw = b.maxX - b.minX, bh = b.maxZ - b.minZ;
      const availW = Math.max(220, vw - leftPx - rightPx);
      const availH = Math.max(220, vh - 140);
      const aspect = availW / availH;
      const fov = (camera.fov * Math.PI) / 180;
      const horizHalf = Math.atan(Math.tan(fov / 2) * aspect);
      const dH = (bh / 2) / Math.tan(fov / 2);
      const dW = (bw / 2) / Math.tan(horizHalf);
      const fitD = clamp(Math.max(dH, dW) * margin, min, 3200);
      const shiftPx = (leftPx - rightPx) / 2;
      const worldPerPx = (2 * fitD * Math.tan(fov / 2)) / availH;
      desired.tx = (b.minX + b.maxX) / 2 - shiftPx * worldPerPx;
      desired.tz = (b.minZ + b.maxZ) / 2;
      desired.dist = fitD;
    };

    /* ---------------- pointer ---------------- */
    let pinnedUntil = 0;
    let touchTip = false;
    const tipFor = (rec: AcRow, clientX: number, clientY: number) => {
      const hostRect = host.getBoundingClientRect();
      const x = clamp(clientX - hostRect.left + 14, 8, hostRect.width - 236);
      const y = clamp(clientY - hostRect.top + 14, 8, hostRect.height - 104);
      const activeYear = live.current.year;
      if (activeYear === "2028") {
        const lead = leaderOf(rec.prediction);
        const isTie = lead.tied.length > 1;
        return {
          x, y,
          title: `${rec.no}. ${rec.name}`,
          sub: `${rec.district} · ${isTie ? "Tie" : lead.leader ? `Leading ${PARTY_LABEL[lead.leader]}` : "No prediction"}`,
          value: isTie
            ? lead.tied.map((p) => `${PARTY_LABEL[p]} ${fmtPct(rec.prediction[p])}`).join(" · ")
            : lead.leader ? `${fmtPct(rec.prediction[lead.leader])} predicted share` : "No data",
          colours: isTie
            ? lead.tied.map((p) => PARTY_COLOR[p])
            : [lead.leader ? PARTY_COLOR[lead.leader] : NO_DATA_COLOR],
        };
      }
      const h = historicalAc(activeYear, rec.no);
      if (!h) {
        return { x, y, title: `${rec.no}. ${rec.name}`, sub: `${rec.district} · No result`, value: "No data", colours: [NO_DATA_COLOR] };
      }
      return {
        x, y,
        title: `${rec.no}. ${rec.name}`,
        sub: `${rec.district} · Winner ${winnerLabel(h.winnerParty)}`,
        value: `${fmtPct(h.winnerShare)} of votes`,
        colours: [winnerColour(h.winnerParty)],
      };
    };
    const pointers = new Map<number, { x: number; y: number }>();
    let dragging = false, dragMoved = false, lastX = 0, lastY = 0, pinch = 0;
    const mouse = { px: -1, py: -1 };
    let hovered: number | null = null;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
      if (e.pointerType === "touch") touchTip = false;
      if (pointers.size === 1) { dragging = true; dragMoved = false; lastX = e.clientX; lastY = e.clientY; }
      else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    };
    const onMove = (e: PointerEvent) => {
      mouse.px = e.clientX; mouse.py = e.clientY;
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, local(e));
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) { dist = clamp(dist * (pinch / d), 200, 3200); desired.dist = dist; }
        pinch = d; return;
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
    const pick = () => {
      if (mouse.px < 0) return null;
      const r = canvas.getBoundingClientRect();
      ndc.set(((mouse.px - r.left) / r.width) * 2 - 1, -(((mouse.py - r.top) / r.height) * 2 - 1));
      ray.setFromCamera(ndc, camera);
      const grp = live.current.district;
      const allowed = grp ? pickables.filter((m) => entries.get(m.userData.acNo as number)?.district === grp) : pickables;
      const hit = ray.intersectObjects(allowed, false)[0];
      return hit ? (hit.object.userData.acNo as number) : null;
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (pointers.size === 0) {
        const isDrag = dragMoved;
        dragging = false; dragMoved = false;
        if (isDrag) return;
        mouse.px = e.clientX; mouse.py = e.clientY;
        const no = pick();
        const grp = live.current.district;
        if (no == null) { pinnedUntil = 0; touchTip = false; hovered = null; setTip(null); live.current.onReset(); return; }
        const entry = entries.get(no);
        if (!entry) return;
        const rec = acRef.current.get(no);
        if (rec) {
          pinnedUntil = Date.now() + 4000;
          if (e.pointerType === "touch") touchTip = true;
          setTip(tipFor(rec, e.clientX, e.clientY));
        }
        hovered = null; // refresh hover state so the tap shows the tooltip
        if (!grp) live.current.onSelectDistrict(entry.district);
        else live.current.onSelectAc(no);
      }
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); dist = clamp(dist * (1 + e.deltaY * 0.0012), 200, 3200); desired.dist = dist; };
    const onLeave = (e: PointerEvent) => {
      /* touch has no hover state; keep the tooltip raised by the tap */
      if (e.pointerType === "touch") return;
      mouse.px = -1; mouse.py = -1; hovered = null; pinnedUntil = 0; touchTip = false; setTip(null);
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const resize = () => {
      const r = host.getBoundingClientRect();
      renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
      camera.aspect = Math.max(1, r.width) / Math.max(1, r.height);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const TAU_CAM = 220, TAU_HEAT = 220, TAU_HOVER = 95, TAU_MAT = 85;
    let last = performance.now();
    let lastSig = "";
    const labelV = new THREE.Vector3();

    const frame = () => {
      const now = performance.now();
      const dt = Math.min(50, Math.max(1, now - last));
      last = now;
      const grp = live.current.district;
      const selAc = live.current.ac;
      const sig = `${grp ?? ""}|${selAc ?? ""}`;
      if (sig !== lastSig) {
        lastSig = sig;
        if (selAc != null) fit([selAc], { margin: 1.75, min: 140 });
        else if (grp) fit(byGroup.get(grp) ?? null);
        else fit(null);
      }

      const aCam = reduced ? 1 : 1 - Math.exp(-dt / TAU_CAM);
      target.x += (desired.tx - target.x) * aCam;
      target.z += (desired.tz - target.z) * aCam;
      dist += (desired.dist - dist) * aCam;
      applyCamera();

      const hov = touchTip ? hovered : pick();
      if (!touchTip && hov !== hovered) {
        hovered = hov;
        const rec = hov != null ? acRef.current.get(hov) : null;
        if (rec) setTip(tipFor(rec, mouse.px, mouse.py));
        else if (Date.now() >= pinnedUntil) setTip(null);
        canvas.style.cursor = hov != null ? "pointer" : dragging ? "grabbing" : "grab";
      }
      if (pinnedUntil && Date.now() > pinnedUntil) {
        pinnedUntil = 0;
        if (touchTip) { touchTip = false; hovered = null; setTip(null); }
        else if (hovered == null) setTip(null);
      }

      const aHeat = reduced ? 1 : 1 - Math.exp(-dt / TAU_HEAT);
      const aHover = reduced ? 1 : 1 - Math.exp(-dt / TAU_HOVER);
      const aMat = reduced ? 1 : 1 - Math.exp(-dt / TAU_MAT);
      for (const e of entries.values()) {
        const inScope = !grp || e.district === grp;
        const isSel = selAc === e.no;
        const isHover = hovered === e.no;
        e.heat += ((isSel ? 1 : 0) - e.heat) * aHeat;
        e.hover += ((isHover ? 1 : 0) - e.hover) * aHover;
        e.isolate += ((inScope ? 0 : 1) - e.isolate) * aMat;
        e.dim += (((selAc != null && e.no !== selAc) ? 1 : 0) - e.dim) * aMat;
        e.elev += (((inScope && (grp || isSel)) ? 6 : 0) + (isSel ? 2 : 0) - e.elev) * aHeat;
        const vis = 1 - e.isolate;
        const dimOp = 1 - e.dim * 0.62;
        const fy = e.fills[live.current.year];
        if (e.cap.map !== fy.texture) {
          e.cap.map = fy.texture;
          if (fy.texture) e.cap.color.set("#ffffff");
          e.cap.needsUpdate = true;
        }
        const base = fy.texture ? new THREE.Color("#ffffff") : fy.color.clone();
        if (!inScope) base.lerp(new THREE.Color(P.none), 0.88);
        const targetCol = base.lerp(new THREE.Color(P.sel), e.heat * 0.12);
        e.cap.color.lerp(targetCol, aMat);
        e.cap.opacity = vis * dimOp;
        e.side.color.lerp(new THREE.Color(P.side), aMat);
        e.side.opacity = vis * 0.9 * dimOp;
        e.line.color.lerp(new THREE.Color(isSel ? P.sel : P.line), aHover);
        e.line.opacity = (grp ? (isSel ? 1 : 0.55) : 0) * vis * (0.5 + 0.5 * dimOp);
        e.group3.visible = vis > 0.01;
        e.group3.position.y = e.elev + e.hover * 1.5;
      }

      for (const [g, mat] of districtLines) {
        mat.opacity = grp ? (g === grp ? 0.85 : 0.03) : 0.7;
      }

      /* labels: districts at state, assemblies when focused */
      const hostRect = host.getBoundingClientRect();
      const toScreen = (x: number, y: number, z: number) => {
        labelV.set(x, y, z).project(camera);
        return { x: (labelV.x * 0.5 + 0.5) * hostRect.width, y: (-labelV.y * 0.5 + 0.5) * hostRect.height, behind: labelV.z > 1 };
      };
      const els = labelRef.current?.querySelectorAll<HTMLElement>("[data-label]");
      if (els) {
        const placed: { x: number; y: number; w: number; h: number }[] = [];
        els.forEach((el) => {
          const noRaw = el.dataset.no ? Number(el.dataset.no) : null;
          const gname = el.dataset.group || null;
          let px = 0, pz = 0, behind = false;
          if (noRaw != null) {
            const e = entries.get(noRaw);
            if (!e || (grp && e.district !== grp)) { el.style.display = "none"; return; }
            const p = toScreen(e.cx, DEPTH + 0.3 + e.group3.position.y, e.cz);
            px = p.x; pz = p.y; behind = p.behind;
          } else if (gname) {
            if (grp) { el.style.display = "none"; return; }
            if (hostRect.width < 480 && !topMobileGroups.has(gname)) { el.style.display = "none"; return; }
            const c = groupCentroid.get(gname);
            if (!c) { el.style.display = "none"; return; }
            const p = toScreen(c.x, DEPTH + 0.4, c.z);
            px = p.x; pz = p.y; behind = p.behind;
          } else { el.style.display = "none"; return; }
          if (behind || px < 6 || px > hostRect.width - 6 || pz < 6 || pz > hostRect.height - 6) { el.style.display = "none"; return; }
          const text = el.textContent ?? "";
          const w = Math.max(36, text.length * 5.4 + 4), hh = 16;
          if (placed.some((b) => Math.abs(b.x - px) < (b.w + w) / 2 && Math.abs(b.y - pz) < (b.h + hh) / 2)) { el.style.display = "none"; return; }
          placed.push({ x: px, y: pz, w, h: hh });
          el.style.display = "";
          el.style.transform = `translate(-50%,-50%) translate(${px.toFixed(1)}px, ${pz.toFixed(1)}px)`;
        });
      }

      /* device markers follow the elevated assembly transform */
      const markerEls = markerRef.current?.querySelectorAll<HTMLElement>("[data-marker]");
      if (markerEls) {
        markerEls.forEach((el) => {
          const def = markerDefsRef.current.get(el.dataset.marker ?? "");
          if (!def || live.current.layer !== "device" || (grp && def.district && def.district !== grp)) {
            el.style.display = "none";
            return;
          }
          let elev = 0;
          if (def.no != null) {
            const e = entries.get(def.no);
            elev = e ? e.elev + e.hover * 1.5 : 0;
          } else if (def.district) {
            const nos = byGroup.get(def.district) ?? [];
            if (nos.length) {
              let sum = 0;
              for (const no of nos) sum += entries.get(no)?.elev ?? 0;
              elev = sum / nos.length;
            }
          }
          const p = toScreen(def.x, DEPTH + 0.9 + elev, def.z);
          if (p.behind || p.x < -20 || p.x > hostRect.width + 20 || p.y < -20 || p.y > hostRect.height + 20) {
            el.style.display = "none";
            return;
          }
          const oy = def.level === "district" ? 22 : def.level === "ac" ? 16 : 14;
          el.style.display = "";
          el.style.transform = `translate(-50%,-50%) translate(${p.x.toFixed(1)}px, ${(p.y + oy).toFixed(1)}px)`;
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
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
      for (const e of entries.values()) {
        e.mesh.geometry.dispose(); e.cap.dispose(); e.side.dispose(); e.line.dispose();
        for (const f of Object.values(e.fills)) f.texture?.dispose();
      }
      for (const mat of districtLines.values()) mat.dispose();
      renderer.dispose();
      setTip(null);
    };
  }, [geo, districtGeo, theme]);

  /* labels for the active level */
  const labels = useMemo<{ key: string; text: string; no?: number; group?: string }[]>(() => {
    if (!geo) return [];
    if (district) {
      return acs.filter((a) => a.district === district).map((a) => ({ key: `ac-${a.no}`, text: a.name, no: a.no }));
    }
    const groups = new Map<string, string>();
    for (const a of acs) groups.set(a.district, a.district);
    return [...groups.values()].map((g) => ({ key: `g-${g}`, text: g, group: g }));
  }, [geo, district, acs]);

  return (
    <div ref={hostRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" aria-label="Telangana assembly map, coloured by leading 2028 prediction party" role="img" />
      {!geo && <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">Loading Telangana geometry…</div>}

      <div ref={labelRef} className="pointer-events-none absolute inset-0">
        {labels.map((l) => (
          <span key={l.key} data-label="" data-no={l.no ?? ""} data-group={l.group ?? ""}
            className="absolute left-0 top-0 whitespace-nowrap rounded px-1 text-[9.5px] font-semibold leading-none"
            style={{ color: PAL[theme].label, background: PAL[theme].halo, display: "none" }}>
            {l.text}
          </span>
        ))}
      </div>

      <div ref={markerRef} className="pointer-events-none absolute inset-0 z-10" aria-label="Illustrative device-brand placement">
        {markers.map((m) => (
          <button key={m.key} data-marker={m.key} data-device-marker type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (m.no != null) onSelectAc(m.no);
              else if (m.district) onSelectDistrict(m.district);
            }}
            style={{ display: "none" }}
            className={`pointer-events-auto absolute left-0 top-0 grid place-items-center rounded-full border border-white/75 bg-card/95 shadow-md backdrop-blur transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60 ${m.level === "brand" ? "size-8" : "size-7"}`}
            title={`${m.title} · ${m.brand} · ${(m.share * 100).toFixed(1)}% of device metadata. Illustrative placement, not GPS.`}
            aria-label={`${m.title}: ${m.brand}, ${(m.share * 100).toFixed(1)} percent of aggregate device metadata. Illustrative placement, not a handset location.`}>
            <img src={brandMarker(m.brand).src} alt="" className="h-4 w-5 object-contain" draggable={false} />
          </button>
        ))}
      </div>

      {tip && (
        <div role="tooltip" className="pointer-events-none absolute z-20 w-[224px] rounded-lg border border-border bg-card/95 px-2.5 py-1.5 text-left shadow-lg backdrop-blur"
          style={{ left: tip.x, top: tip.y }}>
          <p className="text-[11.5px] font-semibold leading-tight">{tip.title}</p>
          <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{tip.sub}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-snug tabular-nums">
            <span className="flex items-center gap-1">
              {tip.colours.map((c, i) => <span key={`${c}-${i}`} className="size-1.5 rounded-sm" style={{ background: c }} />)}
            </span>
            <span>{tip.value}</span>
          </p>
        </div>
      )}
    </div>
  );
}
