"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { rafLoop } from "@/lib/raf-loop";
import { CASES, caseUrl, isLiveCase, type CaseStudy } from "@/lib/cases";
import { PartyMark } from "@/components/site/party-mark";
import STATES from "@/lib/data/india-states.json";
import { cn } from "@/lib/utils";
import { useNavigate } from "@/lib/use-navigate";
import { useTheme } from "@/components/site/theme";

/* Map outline data: "India" by svg-maps (github.com/VictorCazanave/svg-maps), CC BY 4.0 */

const TOUR = CASES.filter((c) => isLiveCase(c.slug));
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const CX = 306, CZ = 348, DEPTH = 8;
const wx = (x: number) => x - CX, wz = (y: number) => y - CZ;

type Stop = { kind: "hero" | "case" | "final"; c?: CaseStudy; t: THREE.Vector3; dist: number; phi: number; theta: number; offX?: number };

/**
 * Fixed full-screen 3D map of India driven by scroll:
 * home → zoom to each tour case → zoomed-out interactive map.
 */
export default function IndiaMap() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dark = theme === "dark";

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const leaderRef = useRef<SVGSVGElement>(null);
  const leaderPath = useRef<SVGPathElement>(null);
  const leaderDot = useRef<SVGCircleElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const pinRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [cardCase, setCardCase] = useState<CaseStudy | null>(null);
  const [activeStop, setActiveStop] = useState(0);
  const [tip, setTip] = useState<{ name: string; sub?: string } | null>(null);

  const stopsCount = TOUR.length + 2;
  const scrollToStop = (i: number) => {
    const tour = document.getElementById("tour");
    if (!tour) return;
    const N = stopsCount - 1;
    const travel = Math.max(1, tour.offsetHeight - (innerHeight - 64));
    const top = tour.getBoundingClientRect().top + scrollY - 64 + (i / (N + 0.35)) * travel;
    scrollTo({ top, behavior: "smooth" });
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const stage = stageRef.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let vw = stage.clientWidth, vh = stage.clientHeight;

    /* ---------- renderer ---------- */
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(vw, vh, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const BG = dark ? 0x121211 : 0xffffff;
    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(BG, 1400, 5200);
    const camera = new THREE.PerspectiveCamera(35, vw / vh, 1, 12000);

    /* ---------- lights ---------- */
    scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x1a1a19 : 0xf4f4f4, dark ? 0.7 : 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, dark ? 1.35 : 2.2);
    sun.position.set(-380, 720, 460);
    sun.shadow.bias = -0.0006;
    sun.shadow.radius = 4;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(dark ? 0x8fb0ff : 0xffffff, dark ? 0.25 : 0.35);
    rim.position.set(500, 180, -600);
    scene.add(rim);
    const hubLight = new THREE.PointLight(0xffffff, 0, 150, 0);
    scene.add(hubLight);

    /* ---------- textures ---------- */
    const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      draw(c.getContext("2d")!, w, h);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const radialTex = canvasTex(128, 128, (g, w, h) => {
      const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,.5)"); r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    });
    const beamTex = canvasTex(4, 256, (g, w, h) => {
      const l = g.createLinearGradient(0, h, 0, 0);
      l.addColorStop(0, "rgba(255,255,255,1)"); l.addColorStop(0.35, "rgba(255,255,255,.45)"); l.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = l; g.fillRect(0, 0, w, h);
    });

    /* ---------- ground ---------- */
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: dark ? 0x1a1a19 : 0xfcfcfc, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const grid = new THREE.GridHelper(9000, 300, dark ? 0x3a3a37 : 0xcfcfcf, dark ? 0x2e2e2c : 0xe6e6e6);
    grid.position.y = 0.05;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = dark ? 0.45 : 0.3;
    scene.add(grid);
    const underGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 1200),
      new THREE.MeshBasicMaterial({ map: radialTex, color: dark ? 0x8fb0ff : 0xcfcfcf, transparent: true, opacity: dark ? 0.08 : 0.04, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    underGlow.rotation.x = -Math.PI / 2;
    underGlow.position.y = 0.2;
    scene.add(underGlow);

    /* ---------- extruded states ---------- */
    const loader = new SVGLoader();
    type St = { g: THREE.Group; cap: THREE.MeshStandardMaterial; side: THREE.MeshStandardMaterial; line: THREE.LineBasicMaterial; partner: boolean; name: string; lift: number; heat: number; hover: number };
    const states: Record<string, St> = {};
    const pickables: THREE.Mesh[] = [];
    const C_BASE = new THREE.Color(dark ? 0x262624 : 0xf4f4f4), C_PARTNER = new THREE.Color(dark ? 0x22344f : 0xd7ebe3), C_HOT = new THREE.Color(dark ? 0x5eead4 : 0x1d9e75);
    const C_HOVER = new THREE.Color(dark ? 0x3a3a37 : 0xd9d9d9), C_HERO = new THREE.Color(dark ? 0x38424f : 0x1f4e78);
    const S_BASE = new THREE.Color(dark ? 0x3a3a37 : 0xe6e6e6), S_HOT = new THREE.Color(dark ? 0x5eead4 : 0x0f6e56);
    for (const s of STATES as { id: string; name: string; d: string }[]) {
      const data = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${s.d}"/></svg>`);
      const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
      const geo = new THREE.ExtrudeGeometry(shapes, { depth: DEPTH, bevelEnabled: false, curveSegments: 2 });
      geo.rotateX(Math.PI / 2);
      geo.translate(-CX, DEPTH, -CZ);
      const partner = TOUR.some((c) => c.state === s.id);
      const cap = new THREE.MeshStandardMaterial({ color: (partner ? C_PARTNER : C_BASE).clone(), roughness: 0.5, metalness: 0.25, emissive: 0x1d9e75, emissiveIntensity: 0 });
      const side = new THREE.MeshStandardMaterial({ color: S_BASE.clone(), roughness: 0.7, metalness: 0.3 });
      const mesh = new THREE.Mesh(geo, [cap, side]);
      mesh.userData.id = s.id;
      const g = new THREE.Group();
      g.add(mesh);
      const pts: number[] = [];
      const y = DEPTH + 0.08;
      const addLoop = (a: THREE.Vector2[]) => {
        for (let i = 0; i < a.length; i++) {
          const p = a[i], q = a[(i + 1) % a.length];
          pts.push(p.x - CX, y, p.y - CZ, q.x - CX, y, q.y - CZ);
        }
      };
      shapes.forEach((sh) => { addLoop(sh.getPoints()); sh.holes.forEach((h) => addLoop(h.getPoints())); });
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const line = new THREE.LineBasicMaterial({ color: partner ? 0xffb866 : dark ? 0x5a5a54 : 0xcfcfcf, transparent: true, opacity: partner ? 0.8 : 0.55 });
      g.add(new THREE.LineSegments(lg, line));
      scene.add(g);
      pickables.push(mesh);
      states[s.id] = { g, cap, side, line, partner, name: s.name, lift: 0, heat: 0, hover: 0 };
    }

    /* ---------- markers ---------- */
    type Mk = { m: THREE.Group; beam: THREE.Mesh; core: THREE.Mesh; halo: THREE.Sprite; rings: THREE.Mesh[]; act: number };
    const markers: Record<string, Mk> = {};
    TOUR.forEach((c, i) => {
      const HUE = c.tour ? dark ? 0x8fb0ff : 0x1f4e78 : dark ? 0x5eead4 : 0x1d9e75, HALO = dark ? 0x5eead4 : 0x1d9e75;
      const m = new THREE.Group();
      m.position.set(wx(c.x), DEPTH, wz(c.y));
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.3, 1.3, 1, 24, 1, true),
        new THREE.MeshBasicMaterial({ map: beamTex, color: HUE, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      const core = new THREE.Mesh(new THREE.SphereGeometry(2, 24, 16), new THREE.MeshBasicMaterial({ color: c.tour ? 0xffffff : dark ? 0x5eead4 : 0x1d9e75 }));
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex, color: HALO, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      const rings = [0, 0.5].map((ph) => {
        const r = new THREE.Mesh(
          new THREE.RingGeometry(2.6, 3.3, 48),
          new THREE.MeshBasicMaterial({ color: HUE, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
        );
        r.rotation.x = -Math.PI / 2;
        r.position.y = 0.3;
        r.userData.ph = ph + i * 0.13;
        m.add(r);
        return r;
      });
      m.add(beam, core, halo);
      scene.add(m);
      markers[c.slug] = { m, beam, core, halo, rings, act: 0 };
    });

    /* ---------- particles ---------- */
    const PN = reduced ? 0 : 900;
    const pp = new Float32Array(PN * 3);
    for (let i = 0; i < PN; i++) { pp[i * 3] = (Math.random() - 0.5) * 1300; pp[i * 3 + 1] = 10 + Math.random() * 320; pp[i * 3 + 2] = (Math.random() - 0.5) * 1100; }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(pp, 3));
    const particles = new THREE.Points(pg, new THREE.PointsMaterial({ size: 2.4, map: radialTex, color: dark ? 0x8fb0ff : 0xcfcfcf, transparent: true, opacity: dark ? 0.2 : 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(particles);

    /* ---------- post ---------- */

    /* ---------- stops ---------- */
    const STOPS: Stop[] = [
      { kind: "hero", t: new THREE.Vector3(60, 0, 20), dist: 1000, phi: 0.62, theta: -0.3 },
      ...TOUR.map((c) => ({ kind: "case" as const, c, t: new THREE.Vector3(wx(c.x), DEPTH, wz(c.y)), dist: 240, phi: 0.9, theta: c.theta ?? 0 })),
      { kind: "final", t: new THREE.Vector3(0, 0, 30), dist: 960, phi: 0.7, theta: 0, offX: -0.18 },
    ];
    const N = STOPS.length - 1;
    const distFor = (s: Stop) => (s.kind === "case" ? Math.max(s.dist, 165 / camera.aspect) : Math.max(s.dist, 1150 / camera.aspect));

    /* ---------- input ---------- */
    let tTarget = 0, tCur = 0;
    const readScroll = () => {
      const tour = document.getElementById("tour");
      if (!tour) return;
      const tourTop = tour.getBoundingClientRect().top + scrollY;
      const travel = Math.max(1, tour.offsetHeight - vh);
      const progress = clamp((scrollY - (tourTop - 64)) / travel, 0, 1);
      tTarget = Math.min(progress * (N + 0.35), N);
    };
    addEventListener("scroll", readScroll, { passive: true });
    readScroll();
    tCur = tTarget;

    const mouse = { x: 0, y: 0, sx: 0, sy: 0, px: -1, py: -1 };
    let userYaw = 0, yawVel = 0, drag: { x: number } | null = null, dragMoved = false, finalOn = false, hovered: string | null = null;
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const isUI = (el: EventTarget | null) => !!(el as HTMLElement)?.closest?.("[data-ui],header,#top");
    const onMove = (e: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      mouse.y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
      mouse.px = e.clientX - rect.left; mouse.py = e.clientY - rect.top;
      if (drag) { const dx = e.clientX - drag.x; drag.x = e.clientX; if (Math.abs(dx) > 1) dragMoved = true; yawVel = -dx * 0.004; userYaw += yawVel; }
    };
    const onDown = (e: PointerEvent) => { if (finalOn && e.pointerType === "mouse" && !isUI(e.target)) { drag = { x: e.clientX }; dragMoved = false; } };
    const onUp = () => { drag = null; };
    const onClick = (e: MouseEvent) => {
      if (!stage.contains(e.target as Node) || !finalOn || dragMoved || isUI(e.target)) return;
      if (hovered) {
        const c = CASES.find((item) => item.state === hovered);
        if (c) {
          navigate.prefetch(caseUrl(c.slug));
          navigate.push(caseUrl(c.slug), { cover: { title: c.title, eyebrow: c.label, subtitle: c.region } });
        }
      }
    };
    addEventListener("pointermove", onMove);
    addEventListener("pointerdown", onDown);
    addEventListener("pointerup", onUp);
    addEventListener("click", onClick);
    const onResize = () => {
      vw = stage.clientWidth; vh = stage.clientHeight;
      camera.aspect = vw / vh; camera.updateProjectionMatrix();
      renderer.setSize(vw, vh, false);
      readScroll();
    };
    addEventListener("resize", onResize);

    /* ---------- loop ---------- */
    const tgt = new THREE.Vector3(), tmp = new THREE.Vector3();
    const project = (v: THREE.Vector3) => { tmp.copy(v).project(camera); return { x: ((tmp.x + 1) / 2) * vw, y: ((1 - tmp.y) / 2) * vh }; };
    let rendered = false, last = performance.now(), lastCardSlug: string | null = null, lastStop = -1, lastTip = "";

    let stageVisible = true;
    const frame = (now: number) => {
      if (!stageVisible) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const time = now / 1000;
      const fr = (r: number) => 1 - Math.pow(1 - r, dt * 60);
      readScroll();
      tCur += (tTarget - tCur) * (reduced ? 1 : 1 - Math.pow(0.0015, dt));
      const finite = Number.isFinite(tCur);
      const iRaw = finite ? Math.floor(tCur) : 0;
      const i = Math.max(0, Math.min(iRaw, N - 1));
      const f = ease(clamp((tCur - i - 0.22) / 0.56, 0, 1));
      const A = STOPS[i] ?? STOPS[0], B = STOPS[i + 1] ?? STOPS[N];
      const sRaw = finite ? Math.round(tCur) : 0;
      const s = Math.max(0, Math.min(sRaw, N));
      const S = STOPS[s] ?? STOPS[N];
      const mobile = vw <= 720;

      /* camera */
      tgt.lerpVectors(A.t, B.t, f);
      let dist = lerp(distFor(A), distFor(B), f);
      if (A.kind === "case" && B.kind === "case") dist += Math.sin(Math.PI * f) * 170;
      let phi = lerp(A.phi, B.phi, f), theta = lerp(A.theta, B.theta, f);
      const heroW = A.kind === "hero" ? 1 - f : 0, finalW = B.kind === "final" ? f : 0;
      finalOn = finalW > 0.9;
      if (!drag) { userYaw += yawVel; yawVel *= 0.92; }
      if (!finalOn) userYaw *= 0.94;
      mouse.sx += (mouse.x - mouse.sx) * fr(0.05); mouse.sy += (mouse.y - mouse.sy) * fr(0.05);
      theta += heroW * Math.sin(time * 0.18) * 0.14 + finalW * (userYaw + Math.sin(time * 0.12) * 0.06) + mouse.sx * 0.06;
      phi = clamp(phi + mouse.sy * 0.04, 0.12, 1.25);
      camera.position.set(tgt.x + dist * Math.sin(phi) * Math.sin(theta), tgt.y + dist * Math.cos(phi), tgt.z + dist * Math.sin(phi) * Math.cos(theta));
      camera.lookAt(tgt);
      const offOf = (st: Stop) => (st.kind === "case" ? 0.16 : st.offX ?? 0);
      const k = lerp(A.kind === "case" ? 1 : 0, B.kind === "case" ? 1 : 0, f);
      const ox = lerp(offOf(A), offOf(B), f);
      camera.setViewOffset(vw, vh, mobile ? 0 : ox * vw, mobile ? (k * 0.2 + finalW * 0.12) * vh : 0, vw, vh);

      /* live case */
      const active = S.kind === "case" ? S.c! : null;
      if (finalOn && mouse.px >= 0 && !drag) {
        ndc.set(mouse.x, -mouse.y); ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObjects(pickables, false)[0];
        hovered = hit ? (hit.object.userData.id as string) : null;
      } else hovered = null;
      const hoverState = finalOn ? hovered : null;
      document.body.style.cursor = finalOn && hovered ? (CASES.some((c) => c.state === hovered) ? "pointer" : "grab") : "";

      for (const id in states) {
        const st = states[id], on = !!active && active.state === id, hv = hoverState === id;
        st.heat += ((on ? 1 : 0) - st.heat) * fr(0.08);
        st.hover += ((hv ? 1 : 0) - st.hover) * fr(0.15);
        st.lift += ((on ? 9 : hv ? 5 : 0) - st.lift) * fr(0.1);
        st.g.position.y = st.lift;
        st.cap.color.copy(st.partner ? C_PARTNER : C_BASE).lerp(C_HERO, heroW * 0.6).lerp(C_HOVER, st.hover * (1 - st.heat)).lerp(C_HOT, st.heat);
        st.cap.emissiveIntensity = st.heat * 0.5;
        st.side.color.copy(S_BASE).lerp(S_HOT, st.heat);
        st.line.opacity = (st.partner ? 0.8 : 0.55) + st.hover * 0.4;
      }

      const sc = clamp(dist / 360, 0.8, 2.8);
      TOUR.forEach((c) => {
        const mk = markers[c.slug], on = !!active && active.slug === c.slug;
        mk.act += ((on ? 1 : 0) - mk.act) * fr(0.08);
        mk.m.position.y = DEPTH + states[c.state].lift;
        mk.m.scale.setScalar(sc * (c.tour ? 1 : 0.8));
        const h = (c.tour ? 26 : 16) + mk.act * 70;
        mk.beam.scale.y = h; mk.beam.position.y = h / 2;
        mk.core.position.y = 2; mk.halo.position.y = 2;
        mk.halo.scale.setScalar(14 + mk.act * 14 + Math.sin(time * 3) * 2);
        mk.rings.forEach((r) => { const p = (time * 0.7 + r.userData.ph) % 1; r.scale.setScalar(1 + p * (4 + mk.act * 4)); (r.material as THREE.MeshBasicMaterial).opacity = (1 - p) * (0.45 + mk.act * 0.55); });
      });
      if (active) { const mk = markers[active.slug].m; hubLight.position.set(mk.position.x, mk.position.y + 40, mk.position.z + 10); }
      hubLight.intensity += ((active ? 1.6 : 0) - hubLight.intensity) * fr(0.06);
      if (PN) { particles.rotation.y = time * 0.012; particles.position.y = Math.sin(time * 0.3) * 4; }

      /* the map now lives inside its own section, so it is never blurred by the page above it */
      if (canvas.style.opacity !== "1") canvas.style.opacity = "1";
      if (railRef.current) { railRef.current.style.opacity = stageVisible ? "1" : "0"; railRef.current.style.pointerEvents = stageVisible ? "auto" : "none"; }

      /* card */
      let cardA = 0;
      if (S.kind === "case") cardA = clamp(1 - (Math.abs(tCur - s) - 0.2) / 0.12, 0, 1);
      const card = cardRef.current;
      const slug = active && cardA > 0 ? active.slug : lastCardSlug;
      if (slug !== lastCardSlug) { lastCardSlug = slug; setCardCase(CASES.find((c) => c.slug === slug) ?? null); }
      if (card && active && cardA > 0) {
        const mm = markers[active.slug].m;
        const mp = project(tmp.set(mm.position.x, mm.position.y + 4, mm.position.z));
        const cw = card.offsetWidth, ch = card.offsetHeight;
        let ax: number, ay: number;
        if (mobile) {
          card.style.left = "16px"; card.style.top = `${vh - 16 - ch}px`;
          card.style.transform = `translateY(${(1 - cardA) * 24}px)`;
          ax = vw / 2; ay = vh - 16 - ch;
        } else {
          let left = mp.x + 80, side = 1;
          if (left + cw > vw - 80) { left = mp.x - 80 - cw; side = -1; }
          const top = clamp(mp.y - ch * 0.45, 24, vh - ch - 24);
          card.style.left = `${left}px`; card.style.top = `${top}px`;
          card.style.transform = `perspective(900px) rotateY(${(1 - cardA) * side * -18}deg) translateX(${(1 - cardA) * side * 24}px)`;
          ax = side > 0 ? left : left + cw; ay = top + 40;
        }
        leaderPath.current?.setAttribute("d", `M${mp.x},${mp.y} C${(mp.x + ax) / 2},${mp.y} ${(mp.x + ax) / 2},${ay} ${ax},${ay}`);
        leaderDot.current?.setAttribute("cx", String(mp.x));
        leaderDot.current?.setAttribute("cy", String(mp.y));
      }
      if (card) { card.style.opacity = String(cardA); card.style.visibility = cardA > 0.01 ? "visible" : "hidden"; }
      if (leaderRef.current) leaderRef.current.style.opacity = String(cardA);

      /* final UI + pins */
      const fA = clamp((tCur - (N - 0.3)) / 0.25, 0, 1);
      CASES.forEach((c) => {
        const p = pinRefs.current[c.slug];
        if (!p) return;
        const show = fA > 0.5 && !mobile;
        p.style.opacity = String(show ? fA : 0);
        p.style.pointerEvents = show ? "auto" : "none";
        if (show) {
          const mk = markers[c.slug];
          const q = project(tmp.set(mk.m.position.x, mk.m.position.y + mk.beam.scale.y * mk.m.scale.y + 6, mk.m.position.z));
          p.style.transform = `translate(${q.x + (c.pinDx ?? 0)}px, ${q.y}px) translate(-50%, -100%)`;
        }
      });
      const tipKey = finalOn && hovered && !drag ? hovered : "";
      if (tipKey !== lastTip) {
        lastTip = tipKey;
        const c = CASES.find((c) => c.state === tipKey);
        setTip(tipKey ? { name: states[tipKey].name, sub: c ? `${c.party} · click to open` : undefined } : null);
      }
      if (tipRef.current) tipRef.current.style.transform = `translate(${mouse.px + 16}px, ${mouse.py + 16}px)`;
      if (s !== lastStop) { lastStop = s; setActiveStop(s); }

      // pause GPU work while the tour section is off screen
      if (stageVisible || !rendered) { renderer.render(scene, camera); rendered = true; }
    };
    const io = new IntersectionObserver(([entry]) => { stageVisible = entry.isIntersecting; }, { threshold: 0 });
    io.observe(stage);
    const stopLoop = rafLoop(frame);

    return () => {
      io.disconnect();
      stopLoop();
      removeEventListener("scroll", readScroll);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerdown", onDown);
      removeEventListener("pointerup", onUp);
      removeEventListener("click", onClick);
      removeEventListener("resize", onResize);
      document.body.style.cursor = "";
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
    };
  }, [dark]);

  const tourIndex = cardCase ? TOUR.indexOf(cardCase) : -1;
  const labels = ["Home", ...TOUR.map((c) => c.label), "All India"];

  return (
    <div ref={stageRef} className="absolute inset-0 overflow-hidden bg-[color:var(--theme-bg)]">
      <canvas ref={canvasRef} className="absolute inset-0 z-0 block h-full w-full" aria-label="3D map of India with ReachOut Analytics campaigns" />
      <div className="india-map-dots pointer-events-none absolute inset-0 z-10 opacity-50" aria-hidden />
      <svg className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[80vw] w-[80vw] -translate-x-1/2 -translate-y-1/2 opacity-30" viewBox="0 0 600 600" fill="none" aria-hidden><g className="india-map-orbit" strokeWidth="0.7" transform="rotate(-22 300 300)"><ellipse cx="300" cy="300" rx="270" ry="196" /><ellipse cx="300" cy="300" rx="220" ry="154" strokeDasharray="2 4" /></g></svg>

      {/* leader line */}
      <svg ref={leaderRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="lg" x1="0" x2="1"><stop offset="0" stopColor="var(--theme-text-3)" /><stop offset="1" stopColor="var(--theme-text-3)" stopOpacity=".3" /></linearGradient>
        </defs>
        <path ref={leaderPath} fill="none" stroke="url(#lg)" strokeWidth="1.5" strokeDasharray="4 5" />
        <circle ref={leaderDot} r="4" fill="var(--theme-text)" />
      </svg>

      {/* small glass case card */}
      <div
        ref={cardRef}
        data-ui
        data-opening-label={cardCase ? `Opening ${cardCase.title}` : undefined}
        role="link"
        tabIndex={0}
        onMouseEnter={() => { if (cardCase) navigate.prefetch(caseUrl(cardCase.slug)); }}
        onFocus={() => { if (cardCase) navigate.prefetch(caseUrl(cardCase.slug)); }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-close]") || !cardCase) return;
          navigate.push(caseUrl(cardCase.slug), { cover: { title: cardCase.title, eyebrow: cardCase.label, subtitle: cardCase.region } });
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !cardCase) return;
          navigate.push(caseUrl(cardCase.slug), { cover: { title: cardCase.title, eyebrow: cardCase.label, subtitle: cardCase.region } });
        }}
        className="invisible absolute left-0 top-0 z-30 w-[calc(100%-32px)] max-w-[300px] cursor-pointer rounded-[16px] border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-4 opacity-0 shadow-[0_10px_30px_rgba(0,0,0,.08)] transition-[box-shadow] hover:shadow-[0_18px_40px_rgba(0,0,0,.12)] sm:w-[300px]"
      >
        <span className="pointer-events-none absolute inset-0 rounded-[16px] border border-transparent" aria-hidden>
          <span className="absolute left-0 top-0 size-3 border-l border-t border-[color:var(--theme-text)]" style={{ margin: "-5px" }} />
          <span className="absolute right-0 top-0 size-3 border-r border-t border-[color:var(--theme-text)]" style={{ margin: "-5px" }} />
          <span className="absolute bottom-0 left-0 size-3 border-b border-l border-[color:var(--theme-text)]" style={{ margin: "-5px" }} />
          <span className="absolute bottom-0 right-0 size-3 border-b border-r border-[color:var(--theme-text)]" style={{ margin: "-5px" }} />
        </span>
        {cardCase && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-2)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--theme-text-3)]">{cardCase.badge}</span>
              <div className="flex items-center gap-2">
                {tourIndex >= 0 && <span className="text-[10px] font-semibold tracking-[0.16em] text-[var(--r-muted)]">{String(tourIndex + 1).padStart(2, "0")} / {String(TOUR.length).padStart(2, "0")}</span>}
              </div>
            </div>
            <div className="mb-2.5 flex items-center gap-3">
              <PartyMark party={cardCase.party} size="md" />
              <div className="min-w-0">
                <h3 className="font-display text-xl font-semibold leading-tight text-[var(--r-ink)]">{cardCase.title}</h3>
                <p className="flex items-center gap-2 truncate text-xs">
                  <b className="shrink-0 font-bold text-[color:var(--theme-text)]">{cardCase.party}</b>
                  <span className="truncate text-[var(--r-muted)]">{cardCase.stateName}</span>
                </p>
              </div>
            </div>
            <p className="mb-3 text-[13px] leading-relaxed text-[var(--r-muted)]">{cardCase.summary}</p>
            <div className="mb-3.5 flex flex-wrap gap-1.5">
              {cardCase.tags.map((t, i) => (
                <span key={t} className={cn("rounded-md px-2 py-1 text-[10.5px] font-semibold", "border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-2)] text-[color:var(--theme-text-2)]")}>{t}</span>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-[var(--r-line)] pt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--r-ink)]">
              View case study
              <span className="grid size-7 place-items-center rounded-full bg-[color:var(--theme-text)] text-[color:var(--theme-surface)]"><ArrowUpRight className="size-4" /></span>
            </div>
          </>
        )}
      </div>

      {/* progress rail */}
      <nav ref={railRef} data-ui className="absolute right-6 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3.5 opacity-0 md:flex" aria-label="Map sections">
        {labels.map((label, i) => (
          <button key={label} onClick={() => scrollToStop(i)} className="group flex items-center justify-end gap-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--r-muted)]">
            <span className={cn("translate-x-1.5 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100", activeStop === i && "translate-x-0 text-[var(--r-ink)] opacity-100")}>{label}</span>
            <i className={cn("block h-2 w-px bg-[color:var(--theme-border)] transition-all duration-300", activeStop === i && "h-4 w-0.5 bg-[color:var(--theme-text)]")} />
          </button>
        ))}
      </nav>

      {/* small interaction hint */}
      <p className="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[color:var(--theme-text-2)]">Drag to rotate · Select a state</p>

      {/* labels over markers in the zoomed-out view */}
      {TOUR.map((c) => (
        <button
          key={c.slug}
          ref={(el) => { pinRefs.current[c.slug] = el; }}
          data-ui
          onClick={() => { navigate.prefetch(caseUrl(c.slug)); navigate.push(caseUrl(c.slug), { cover: { title: c.title, eyebrow: c.label, subtitle: c.region } }); }}
          className="absolute left-0 top-0 z-20 whitespace-nowrap rounded-full border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--theme-text)] opacity-0 shadow-sm transition-opacity"
          style={{ pointerEvents: "none" }}
        >
          {c.party} · {c.label}
        </button>
      ))}

      <div className="india-map-fade pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20" aria-hidden />

      <div ref={tipRef} className={cn("pointer-events-none absolute left-0 top-0 z-30 whitespace-nowrap rounded-lg border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] px-3 py-2 text-xs font-semibold text-[color:var(--theme-text)] shadow-lg transition-opacity", tip ? "opacity-100" : "opacity-0")}>
        {tip?.name}
        {tip?.sub && <small className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] text-[color:var(--theme-text-2)]">{tip.sub}</small>}
      </div>
    </div>
  );
}
