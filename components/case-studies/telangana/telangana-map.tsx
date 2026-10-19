"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { geoIdentity } from "d3-geo";
import { rafLoop } from "@/lib/raf-loop";
import { PARTY_META, type TgParty } from "@/lib/telangana/parties";
import { leadingParty, type AcRecord } from "@/lib/telangana/model";
import { brandMarker } from "@/lib/telangana/brands";

/* =====================================================================
   Telangana 2.5D assembly map — Telangana only.

   119 sourced AC polygons (simplified copy in /public/telangana).
   Fill = leading 2028 survey party in that assembly, on a documented
   shared lightness scale (see `leadIntensity`). Focus uses the uploaded
   AC-derived analytical grouping — not an official district boundary.
   ===================================================================== */

const BOX = 1000;
const DEPTH = 12;
const CONTESTED = ["BRS", "INC", "BJP", "AIMIM", "TDP", "JSP", "Others"] as const;

export type MapTheme = "light" | "dark";

type Feature = {
  type: "Feature";
  properties: { acNo: number; name: string; group: string };
  geometry: { type: string; coordinates: unknown };
};
type FC = { type: "FeatureCollection"; features: Feature[] };

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
  onReady?: () => void;
  resetNonce: number;
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const PAL: Record<MapTheme, {
  none: string; side: number; line: string; label: string; halo: string; rising: number;
}> = {
  dark: {
    none: "#2b3442", side: 0.4, line: "rgba(190,202,218,.48)", label: "#e8edf4", halo: "rgba(6,10,18,.86)", rising: 0.14,
  },
  light: {
    none: "#dfe5ec", side: 0.16, line: "rgba(70,86,104,.52)", label: "#1b2430", halo: "rgba(255,255,255,.94)", rising: 0.1,
  },
};

/** Documented shared fill scale: lead share 25% → 45% density, 55%+ → full. */
export function leadIntensity(sharePct: number | null): number {
  if (sharePct === null) return 0;
  return clamp(0.45 + ((sharePct - 25) / 30) * 0.55, 0.45, 1);
}

type LabelOut = { key: string; text: string; x: number; y: number };
type MarkerOut = { ac: number; name: string; brand: string; src: string; count: number; x: number; y: number };

export default function TelanganaMap(props: TgMapProps) {
  const { acs, theme, group, selectedAcs, layer, showLabels, resetNonce } = props;

  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [geo, setGeo] = useState<FC | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<LabelOut[]>([]);
  const [markers, setMarkers] = useState<MarkerOut[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);

  // live values for the render loop (no scene rebuild on selection)
  const groupRef = useRef(group);
  const selRef = useRef(selectedAcs);
  const layerRef = useRef(layer);
  const labelsRef = useRef(showLabels);
  const hoverRef = useRef<number | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  groupRef.current = group;
  selRef.current = selectedAcs;
  layerRef.current = layer;
  labelsRef.current = showLabels;

  const acByNo = useMemo(() => new Map(acs.map((a) => [a.no, a])), [acs]);
  const acRef = useRef(acByNo);
  acRef.current = acByNo;

  const apiRef = useRef<{
    fit: (nos: number[] | null, opts?: { instant?: boolean; maxZoom?: number; pad?: number }) => void;
    paint: () => void;
    sync: () => void;
  } | null>(null);

  const onReady = props.onReady;
  useEffect(() => {
    let cancelled = false;
    fetch("/telangana/telangana-ac.geojson")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: FC) => { if (!cancelled) { setGeo(d); onReady?.(); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "geometry unavailable"); });
    return () => { cancelled = true; };
  }, [onReady]);

  /* ---------------- scene ---------------- */
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!geo || !host || !canvas) return;

    const W = host.clientWidth || 800;
    const H = host.clientHeight || 500;
    const pal = PAL[theme];

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 1, 4000);
    scene.add(new THREE.AmbientLight(0xffffff, theme === "dark" ? 1.6 : 2));
    const key = new THREE.DirectionalLight(0xffffff, theme === "dark" ? 1.6 : 1.5);
    key.position.set(-500, 900, 300);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, theme === "dark" ? 0.5 : 0.3);
    rim.position.set(700, 420, -600);
    scene.add(rim);

    const projection = geoIdentity().reflectY(true).fitSize([BOX, BOX], geo as never);
    const project = (lon: number, lat: number) => {
      const p = projection([lon, lat]);
      return { x: p ? p[0] : 0, y: p ? p[1] : 0 };
    };

    type Entry = {
      no: number; group: string; name: string;
      mesh: THREE.Mesh; top: THREE.MeshStandardMaterial; side: THREE.MeshStandardMaterial;
      cx: number; cz: number;
      b: { minX: number; maxX: number; minY: number; maxY: number };
    };
    const entries: Entry[] = [];
    const byNo = new Map<number, Entry>();

    for (const f of geo.features) {
      const rings = f.geometry.type === "Polygon"
        ? (f.geometry.coordinates as number[][][])
        : (f.geometry.coordinates as number[][][][]).flat();
      if (!rings.length) continue;
      const shape = new THREE.Shape();
      rings.forEach((ring, ri) => {
        if (ring.length < 4) return;
        const pts = ring.map(([lon, lat]) => project(lon, lat));
        if (ri === 0) {
          shape.moveTo(pts[0].x, -pts[0].y);
          for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, -pts[i].y);
          shape.closePath();
        } else {
          const hole = new THREE.Path();
          hole.moveTo(pts[0].x, -pts[0].y);
          for (let i = 1; i < pts.length; i++) hole.lineTo(pts[i].x, -pts[i].y);
          hole.closePath();
          shape.holes.push(hole);
        }
      });
      let geom: THREE.ExtrudeGeometry;
      try { geom = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false, curveSegments: 1 }); }
      catch { continue; }
      geom.rotateX(-Math.PI / 2);
      geom.computeBoundingBox();
      const bb = geom.boundingBox!;
      const top = new THREE.MeshStandardMaterial({ color: 0x8a94a3, roughness: 0.84, metalness: 0.03 });
      const side = new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 0.94, metalness: 0.02, transparent: true, opacity: 0.92 });
      const mesh = new THREE.Mesh(geom, [top, side]);
      mesh.userData.acNo = f.properties.acNo;
      scene.add(mesh);
      const e: Entry = {
        no: f.properties.acNo, group: f.properties.group, name: f.properties.name,
        mesh, top, side,
        cx: (bb.min.x + bb.max.x) / 2, cz: (bb.min.z + bb.max.z) / 2,
        b: { minX: bb.min.x, maxX: bb.max.x, minY: bb.min.z, maxY: bb.max.z },
      };
      entries.push(e);
      byNo.set(e.no, e);
    }

    const stateBox = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    for (const e of entries) {
      stateBox.minX = Math.min(stateBox.minX, e.b.minX);
      stateBox.maxX = Math.max(stateBox.maxX, e.b.maxX);
      stateBox.minY = Math.min(stateBox.minY, e.b.minY);
      stateBox.maxY = Math.max(stateBox.maxY, e.b.maxY);
    }

    const cam = { x: BOX / 2, z: BOX / 2, zoom: 0.8 };
    const target = { ...cam };
    let animStart = 0;
    let animFrom: { x: number; z: number; zoom: number } | null = null;
    const DUR = 700;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // The ortho camera looks down at an angle, so a world-Z span is
    // foreshortened on screen. Fit must account for it or the map reads small.
    const CAM_H = 1200, CAM_D = 1100;
    const fwd = new THREE.Vector3(0, -CAM_H, -CAM_D).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const FZ = Math.abs(worldUp.clone().sub(fwd.clone().multiplyScalar(worldUp.dot(fwd))).normalize().z);

    const fit = (nos: number[] | null, opts: { instant?: boolean; maxZoom?: number; pad?: number } = {}) => {
      const { instant = false, maxZoom = 30, pad = 1.06 } = opts;
      let b = stateBox;
      if (nos && nos.length) {
        b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
        for (const no of nos) {
          const e = byNo.get(no);
          if (!e) continue;
          b.minX = Math.min(b.minX, e.b.minX); b.maxX = Math.max(b.maxX, e.b.maxX);
          b.minY = Math.min(b.minY, e.b.minY); b.maxY = Math.max(b.maxY, e.b.maxY);
        }
        if (!Number.isFinite(b.minX)) b = stateBox;
      }
      const bw = b.maxX - b.minX, bh = b.maxY - b.minY;
      target.x = (b.minX + b.maxX) / 2;
      target.z = (b.minY + b.maxY) / 2 - bh * 0.04;
      target.zoom = clamp(Math.min(
        W / (bw * pad + 12),
        H / (bh * FZ * pad + 12),
      ), 0.4, maxZoom);
      if (instant || reduced) {
        Object.assign(cam, target);
        animStart = 0;
      } else {
        animFrom = { ...cam };
        animStart = performance.now();
      }
    };

    const applyCamera = () => {
      camera.zoom = cam.zoom;
      camera.position.set(cam.x, 1200, cam.z + 1100);
      camera.lookAt(cam.x, 2, cam.z);
      camera.updateProjectionMatrix();
    };

    const toScreen = (x: number, y: number) => {
      const v = new THREE.Vector3(x, DEPTH + 3, y).project(camera);
      return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H };
    };

    const paint = () => {
      const g = groupRef.current;
      const sel = new Set(selRef.current);
      const hov = hoverRef.current;
      const dark = theme === "dark";
      for (const e of entries) {
        const rec = acRef.current.get(e.no);
        const inGroup = !g || e.group === g;
        const lead = leadingParty(rec?.a2028 ?? {}, CONTESTED as unknown as string[]);
        const has = (rec?.answered2028 ?? 0) > 0 && !!lead.party;
        const col = has ? new THREE.Color(PARTY_META[lead.party as TgParty].color) : new THREE.Color(pal.none);
        if (has) col.lerp(new THREE.Color(dark ? "#0b1016" : "#ffffff"), 1 - leadIntensity(lead.share));
        if (!inGroup) col.lerp(new THREE.Color(pal.none), 0.7);
        e.top.color.copy(col);
        e.top.transparent = !inGroup;
        e.top.opacity = inGroup ? 1 : 0.5;
        const isSel = sel.has(e.no);
        e.top.emissive.set(isSel ? (dark ? 0xffb866 : 0xc2640c) : 0x000000);
        e.top.emissiveIntensity = isSel ? 0.3 : 0;
        e.side.color.copy(col).multiplyScalar(pal.side);
        e.side.opacity = inGroup ? 1 : 0.3;
        e.mesh.position.y = isSel ? 7 : 0;
      }
      if (hov != null) {
        const e = byNo.get(hov);
        if (e) { e.top.emissive.set(0xffffff); e.top.emissiveIntensity = 0.2; }
      }
    };

    const syncOverlays = () => {
      const g = groupRef.current;
      const wantLabels = labelsRef.current;
      const wantDevice = layerRef.current === "device";

      if (wantLabels) {
        const out: LabelOut[] = [];
        const placed: { x: number; y: number; w: number; h: number }[] = [];
        const add = (key: string, text: string, p: { x: number; y: number }) => {
          if (p.x < 10 || p.x > W - 10 || p.y < 10 || p.y > H - 10) return;
          const w = Math.max(40, text.length * 5.6), h = 14;
          if (placed.some((b) => Math.abs(b.x - p.x) < (b.w + w) / 2 && Math.abs(b.y - p.y) < (b.h + h) / 2)) return;
          placed.push({ x: p.x, y: p.y, w, h });
          out.push({ key, text, x: p.x, y: p.y });
        };
        if (g) {
          for (const e of entries) if (e.group === g) add(`ac-${e.no}`, e.name, toScreen(e.cx, e.cz));
        } else {
          const groups = new Map<string, { x: number; y: number; n: number }>();
          for (const e of entries) {
            const p = toScreen(e.cx, e.cz);
            const acc = groups.get(e.group) ?? { x: 0, y: 0, n: 0 };
            acc.x += p.x; acc.y += p.y; acc.n += 1;
            groups.set(e.group, acc);
          }
          for (const [name, a] of groups) add(`g-${name}`, name, { x: a.x / a.n, y: a.y / a.n });
        }
        setLabels(out);
      } else setLabels([]);

      if (wantDevice) {
        const sel = new Set(selRef.current);
        const scope = sel.size ? [...sel] : entries.filter((e) => !g || e.group === g).map((e) => e.no);
        const out: MarkerOut[] = [];
        for (const no of scope) {
          const e = byNo.get(no);
          const rec = acRef.current.get(no);
          if (!e || !rec || !rec.deviceTotal) continue;
          const [brand, count] = Object.entries(rec.device).sort((a, b) => b[1] - a[1])[0] ?? ["Unknown", 0];
          const p = toScreen(e.cx, e.cz);
          if (p.x < 16 || p.x > W - 16 || p.y < 16 || p.y > H - 16) continue;
          out.push({ ac: no, name: rec.name, brand, src: brandMarker(brand).src, count, x: p.x, y: p.y });
        }
        setMarkers(out.slice(0, 60));
      } else setMarkers([]);
    };

    /* pointer picking */
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    const pick = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = ((clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(entries.map((e) => e.mesh), false);
      for (const h of hits) {
        const no = h.object.userData.acNo as number;
        const e = byNo.get(no);
        if (!e) continue;
        if (groupRef.current && e.group !== groupRef.current) continue;
        return no;
      }
      return null;
    };
    const onMove = (ev: PointerEvent) => {
      const no = pick(ev.clientX, ev.clientY);
      if (no !== hoverRef.current) { hoverRef.current = no; setHovered(no); paint(); }
      propsRef.current.onHover(no, ev.clientX, ev.clientY);
      canvas.style.cursor = no ? "pointer" : "default";
    };
    const onDown = (ev: PointerEvent) => { down = { x: ev.clientX, y: ev.clientY }; };
    const onUp = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 6) return;
      const no = pick(ev.clientX, ev.clientY);
      if (no == null) return;
      const e = byNo.get(no);
      if (!e) return;
      if (!groupRef.current) propsRef.current.onSelectGroup(e.group);
      else propsRef.current.onToggleAc(no, ev.shiftKey || ev.metaKey || ev.ctrlKey);
    };
    const onLeave = () => { hoverRef.current = null; setHovered(null); paint(); propsRef.current.onHover(null, 0, 0); };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);

    fit(null, { instant: true });
    applyCamera();
    paint();
    syncOverlays();

    let lastOverlay = 0;
    const loop = rafLoop((now) => {
      let moving = false;
      if (animStart && animFrom) {
        const t = clamp((now - animStart) / DUR, 0, 1);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        cam.x = animFrom.x + (target.x - animFrom.x) * e;
        cam.z = animFrom.z + (target.z - animFrom.z) * e;
        cam.zoom = animFrom.zoom + (target.zoom - animFrom.zoom) * e;
        moving = true;
        if (t >= 1) { Object.assign(cam, target); animStart = 0; animFrom = null; moving = false; }
        applyCamera();
      }
      if (moving) syncOverlays();
      else if (now - lastOverlay > 350) { lastOverlay = now; syncOverlays(); }
      renderer.render(scene, camera);
    });

    const onResize = () => {
      const w = host.clientWidth || W, h = host.clientHeight || H;
      renderer.setSize(w, h, false);
      camera.left = -w / 2; camera.right = w / 2; camera.top = h / 2; camera.bottom = -h / 2;
      fit(groupRef.current ? entries.filter((e) => e.group === groupRef.current).map((e) => e.no) : null, { instant: true });
      applyCamera();
      paint();
      syncOverlays();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    apiRef.current = { fit, paint, sync: syncOverlays };

    return () => {
      loop();
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      entries.forEach((e) => { e.mesh.geometry.dispose(); e.top.dispose(); e.side.dispose(); });
      renderer.dispose();
      apiRef.current = null;
    };
  }, [geo, theme]);

  /* selection / layer / label changes: repaint + refit through the bridge */
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.paint();
    if (selectedAcs.length) {
      // Keep district context: cap the AC zoom instead of filling the panel
      // with one small urban polygon.
      api.fit(selectedAcs, { maxZoom: 13, pad: 1.3 });
    } else {
      const nos = group ? acs.filter((a) => a.group === group).map((a) => a.no) : null;
      api.fit(nos);
    }
    api.sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, selectedAcs, layer, showLabels]);

  /* Reset View restores the statewide camera */
  useEffect(() => {
    if (!resetNonce) return;
    const api = apiRef.current;
    if (!api) return;
    api.fit(null);
    api.paint();
    api.sync();
  }, [resetNonce]);

  const legend = CONTESTED;

  return (
    <div ref={hostRef} className="relative h-full w-full overflow-hidden rounded-2xl border border-border bg-card">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" aria-label="Telangana assembly map" role="img" />

      {!geo && !error && <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">Loading Telangana geometry…</div>}
      {error && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">Map geometry could not be loaded ({error}).</div>}

      {labels.map((l) => (
        <span key={l.key} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded px-1 text-[9.5px] font-semibold leading-none" style={{ left: l.x, top: l.y, color: PAL[theme].label, background: PAL[theme].halo }}>
          {l.text}
        </span>
      ))}

      {markers.map((m) => (
        <button
          key={`${m.ac}-${m.brand}`}
          type="button"
          onClick={(e) => props.onToggleAc(m.ac, e.shiftKey || e.metaKey || e.ctrlKey)}
          title={`${m.name}: ${m.brand} — ${m.count} original entries (aggregate metadata)`}
          aria-label={`${m.name}: ${m.brand}, ${m.count} original device-metadata entries. Aggregate assembly marker, not a handset location.`}
          className="absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-white shadow-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
          style={{ left: m.x, top: m.y }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.src} alt="" className="h-6 w-9 object-contain" draggable={false} />
          <span className="absolute -bottom-1.5 rounded-full bg-foreground px-1 text-[8px] font-bold leading-tight text-background">{m.count}</span>
        </button>
      ))}

      <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card/85 px-2.5 py-2 backdrop-blur">
        {legend.map((p) => (
          <span key={p} className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <span className="size-2.5 rounded-sm" style={{ background: PARTY_META[p].color }} />
            {PARTY_META[p].short}
          </span>
        ))}
        <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
          <span className="size-2.5 rounded-sm" style={{ background: PAL[theme].none }} />
          No answers
        </span>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 rounded-lg border border-border bg-card/85 px-2 py-1 text-[9.5px] text-muted-foreground backdrop-blur">
        {layer === "device" ? "Device mix by assembly · aggregate" : "Leading 2028 survey party"}
      </div>

      <span className="sr-only" aria-live="polite">{hovered != null ? `Assembly ${hovered} highlighted` : ""}</span>
    </div>
  );
}
