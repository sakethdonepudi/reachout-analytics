"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { geoIdentity } from "d3-geo";
import { rafLoop } from "@/lib/raf-loop";
import { PARTY_COLOR, pinkScale, fmtPct, type AcRow } from "@/lib/telangana/oct26";

/* =====================================================================
   Telangana 2.5D map — October workbook.

   Genuine extruded geometry, perspective camera (34°, φ 0.6), the same
   lighting rig and ~700 ms elapsed-time easing as Tamil Nadu. Fills use a
   single sequential pink scale for the BRS 2028 prediction share; the scale
   is labelled by the caller. District grouping is the workbook's analytical
   AC grouping, not an official administrative boundary.
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

type Props = {
  acs: AcRow[];
  district: string | null;
  ac: number | null;
  theme: "light" | "dark";
  onSelectDistrict: (name: string) => void;
  onSelectAc: (no: number) => void;
  onReset: () => void;
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

const PAL = {
  dark: { none: "#2b3442", side: "#1c2531", line: "rgb(190,202,218)", sel: "#ffffff", label: "#e8edf4", halo: "rgba(6,10,18,.86)" },
  light: { none: "#e7ebef", side: "#d3d9e0", line: "rgb(70,86,104)", sel: "#7a1f4d", label: "#1b2430", halo: "rgba(255,255,255,.94)" },
};

export default function TelanganaMap({ acs, district, ac, theme, onSelectDistrict, onSelectAc, onReset }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<FC | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; title: string; sub: string; value: string } | null>(null);

  const live = useRef({ acs, district, ac, theme, onSelectDistrict, onSelectAc, onReset });
  live.current = { acs, district, ac, theme, onSelectDistrict, onSelectAc, onReset };
  const acByNo = useMemo(() => new Map(acs.map((a) => [a.no, a])), [acs]);
  const acRef = useRef(acByNo);
  acRef.current = acByNo;

  useEffect(() => {
    let cancelled = false;
    fetch("/telangana/telangana-ac.geojson")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: FC) => { if (!cancelled) setGeo(d); })
      .catch(() => { if (!cancelled) setGeo(null); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!geo || !host || !canvas) return;
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
      heat: number; hover: number; isolate: number; dim: number; elev: number;
      bounds: { minx: number; maxx: number; minz: number; maxz: number }; cx: number; cz: number;
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

      const cap = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.none), roughness: 0.95, metalness: 0.03, side: THREE.DoubleSide, transparent: true, opacity: 1 });
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

      entries.set(f.properties.acNo, {
        no: f.properties.acNo, district: f.properties.group, group3, mesh, cap, side, line,
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
        const wasDrag = dragMoved;
        dragging = false; dragMoved = false;
        if (wasDrag) return;
        const no = pick();
        const grp = live.current.district;
        if (no == null) { live.current.onReset(); return; }
        const entry = entries.get(no);
        if (!entry) return;
        if (!grp) live.current.onSelectDistrict(entry.district);
        else live.current.onSelectAc(no);
      }
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); dist = clamp(dist * (1 + e.deltaY * 0.0012), 200, 3200); desired.dist = dist; };
    const onLeave = () => { mouse.px = -1; mouse.py = -1; hovered = null; setTip(null); };

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

      const hov = pick();
      if (hov !== hovered) {
        hovered = hov;
        const rec = hov != null ? acRef.current.get(hov) : null;
        if (rec) {
          const hostRect = host.getBoundingClientRect();
          setTip({ x: clamp(mouse.px - hostRect.left + 14, 8, hostRect.width - 210), y: clamp(mouse.py - hostRect.top + 14, 8, hostRect.height - 90), title: `${rec.no}. ${rec.name}`, sub: rec.district, value: `${fmtPct(rec.prediction.BRS)} BRS` });
        } else setTip(null);
        canvas.style.cursor = hov != null ? "pointer" : dragging ? "grabbing" : "grab";
      }

      const aHeat = reduced ? 1 : 1 - Math.exp(-dt / TAU_HEAT);
      const aHover = reduced ? 1 : 1 - Math.exp(-dt / TAU_HOVER);
      const aMat = reduced ? 1 : 1 - Math.exp(-dt / TAU_MAT);
      for (const e of entries.values()) {
        const rec = acRef.current.get(e.no);
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
        const known = (rec?.answered2028 ?? 0) > 0;
        const base = known && rec ? new THREE.Color(pinkScale(rec.prediction.BRS)) : new THREE.Color(P.none);
        if (!inScope) base.lerp(new THREE.Color(P.none), 0.88);
        const targetCol = base.lerp(new THREE.Color(P.sel), e.heat * 0.12);
        e.cap.color.lerp(targetCol, aMat);
        e.cap.opacity = vis * dimOp;
        e.side.color.lerp(new THREE.Color(P.side), aMat);
        e.side.opacity = vis * 0.9 * dimOp;
        e.line.color.lerp(new THREE.Color(isSel ? P.sel : P.line), aHover);
        e.line.opacity = (isSel ? 1 : 0.55) * vis * (0.5 + 0.5 * dimOp);
        e.group3.visible = vis > 0.01;
        e.group3.position.y = e.elev + e.hover * 1.5;
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
      for (const e of entries.values()) { e.mesh.geometry.dispose(); e.cap.dispose(); e.side.dispose(); e.line.dispose(); }
      renderer.dispose();
      setTip(null);
    };
  }, [geo, theme]);

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
      <canvas ref={canvasRef} className="block h-full w-full touch-none" aria-label="Telangana assembly map" role="img" />
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

      {tip && (
        <div role="tooltip" className="pointer-events-none absolute z-20 w-[200px] rounded-lg border border-border bg-card/95 px-2.5 py-1.5 text-left shadow-lg backdrop-blur"
          style={{ left: tip.x, top: tip.y }}>
          <p className="text-[11.5px] font-semibold leading-tight">{tip.title}</p>
          <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{tip.sub} · analytical grouping</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] tabular-nums">
            <span className="size-1.5 rounded-sm" style={{ background: PARTY_COLOR.BRS }} />
            BRS prediction {tip.value}
          </p>
        </div>
      )}
    </div>
  );
}
