"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, X } from "lucide-react";
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { rafLoop } from "@/lib/raf-loop";
import ShimmerButton from "@/components/ui/shimmer-button";
import { CASES, UPCOMING, caseUrl, leaderById, type CaseStudy } from "@/lib/cases";
import STATES from "@/lib/data/india-states.json";
import { cn } from "@/lib/utils";

/* Map outline data: "India" by svg-maps (github.com/VictorCazanave/svg-maps), CC BY 4.0 */

const TOUR = CASES.filter((c) => c.tour);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const CX = 306, CZ = 348, DEPTH = 8;
const wx = (x: number) => x - CX, wz = (y: number) => y - CZ;

type Stop = { kind: "hero" | "case" | "final"; c?: CaseStudy; t: THREE.Vector3; dist: number; phi: number; theta: number; offX?: number };

/**
 * Fixed full-screen 3D map of India driven by scroll:
 * home → zoom to each tour case → zoomed-out interactive map → pulls away as
 * the contact section (with the globe) comes in.
 */
export default function IndiaMap() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const leaderRef = useRef<SVGSVGElement>(null);
  const leaderPath = useRef<SVGPathElement>(null);
  const leaderDot = useRef<SVGCircleElement>(null);
  const finalRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const pinRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const selectedRef = useRef<string | null>(null);
  const chipHoverRef = useRef<string | null>(null);

  const [cardCase, setCardCase] = useState<CaseStudy | null>(null);
  const [cardIsFinal, setCardIsFinal] = useState(false);
  const [selected, setSelectedState] = useState<string | null>(null);
  const [activeStop, setActiveStop] = useState(0);
  const [tip, setTip] = useState<{ name: string; sub?: string } | null>(null);

  const setSelected = (id: string | null) => {
    selectedRef.current = id;
    setSelectedState(id);
  };

  const stopsCount = TOUR.length + 2;
  const scrollToStop = (i: number) => {
    const tour = document.getElementById("tour");
    if (!tour) return;
    const end = tour.offsetTop + tour.offsetHeight - innerHeight;
    const N = stopsCount - 1;
    scrollTo({ top: (end * i) / (N + 0.35), behavior: "smooth" });
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- renderer ---------- */
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const BG = 0x061331;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);
    scene.fog = new THREE.Fog(BG, 1400, 5200);
    const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 1, 12000);

    /* ---------- lights ---------- */
    scene.add(new THREE.HemisphereLight(0xffffff, 0x0a1636, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-380, 720, 460);
    sun.shadow.bias = -0.0006;
    sun.shadow.radius = 4;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x9cc6ff, 0.6);
    rim.position.set(500, 180, -600);
    scene.add(rim);
    const hubLight = new THREE.PointLight(0xffa640, 0, 150, 0);
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
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: 0x0a1c48, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const grid = new THREE.GridHelper(9000, 300, 0x234c9a, 0x163777);
    grid.position.y = 0.05;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.45;
    scene.add(grid);
    const underGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 1200),
      new THREE.MeshBasicMaterial({ map: radialTex, color: 0x7fb2ff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    underGlow.rotation.x = -Math.PI / 2;
    underGlow.position.y = 0.2;
    scene.add(underGlow);

    /* ---------- extruded states ---------- */
    const loader = new SVGLoader();
    type St = { g: THREE.Group; cap: THREE.MeshStandardMaterial; side: THREE.MeshStandardMaterial; line: THREE.LineBasicMaterial; partner: boolean; name: string; lift: number; heat: number; hover: number };
    const states: Record<string, St> = {};
    const pickables: THREE.Mesh[] = [];
    const C_BASE = new THREE.Color(0x1f4a9a), C_PARTNER = new THREE.Color(0x2f66c8), C_HOT = new THREE.Color(0xd9600a);
    const C_HOVER = new THREE.Color(0x3f7ee0), C_HERO = new THREE.Color(0x7aa6ee);
    const S_BASE = new THREE.Color(0x0c2458), S_HOT = new THREE.Color(0x9a4a00);
    for (const s of STATES as { id: string; name: string; d: string }[]) {
      const data = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${s.d}"/></svg>`);
      const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
      const geo = new THREE.ExtrudeGeometry(shapes, { depth: DEPTH, bevelEnabled: false, curveSegments: 2 });
      geo.rotateX(Math.PI / 2);
      geo.translate(-CX, DEPTH, -CZ);
      const partner = CASES.some((c) => c.state === s.id);
      const cap = new THREE.MeshStandardMaterial({ color: (partner ? C_PARTNER : C_BASE).clone(), roughness: 0.5, metalness: 0.25, emissive: 0xff6a00, emissiveIntensity: 0 });
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
      const line = new THREE.LineBasicMaterial({ color: partner ? 0xffb866 : 0x6f95dd, transparent: true, opacity: partner ? 0.8 : 0.55 });
      g.add(new THREE.LineSegments(lg, line));
      scene.add(g);
      pickables.push(mesh);
      states[s.id] = { g, cap, side, line, partner, name: s.name, lift: 0, heat: 0, hover: 0 };
    }

    /* ---------- markers ---------- */
    type Mk = { m: THREE.Group; beam: THREE.Mesh; core: THREE.Mesh; halo: THREE.Sprite; rings: THREE.Mesh[]; act: number };
    const markers: Record<string, Mk> = {};
    CASES.forEach((c, i) => {
      const HUE = c.tour ? 0xffa640 : 0x2fbf4a, HALO = c.tour ? 0xff8c1a : 0x1faa3a;
      const m = new THREE.Group();
      m.position.set(wx(c.x), DEPTH, wz(c.y));
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.3, 1.3, 1, 24, 1, true),
        new THREE.MeshBasicMaterial({ map: beamTex, color: HUE, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      const core = new THREE.Mesh(new THREE.SphereGeometry(2, 24, 16), new THREE.MeshBasicMaterial({ color: c.tour ? 0xfff0e0 : 0xe6ffe9 }));
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
    const particles = new THREE.Points(pg, new THREE.PointsMaterial({ size: 2.4, map: radialTex, color: 0xbcd4ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
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
    let tTarget = 0, tCur = 0, contactP = 0, heroP = 0;
    const readScroll = () => {
      const tour = document.getElementById("tour");
      const contact = document.getElementById("contact");
      if (!tour) return;
      const end = tour.offsetTop + tour.offsetHeight - innerHeight;
      tTarget = clamp(scrollY / Math.max(1, end), 0, 1) * (N + 0.35);
      tTarget = Math.min(tTarget, N);
      heroP = clamp(scrollY / innerHeight, 0, 1);
      contactP = contact ? clamp(1 - contact.getBoundingClientRect().top / innerHeight, 0, 1) : 0;
    };
    addEventListener("scroll", readScroll, { passive: true });
    readScroll();
    tCur = tTarget;

    const mouse = { x: 0, y: 0, sx: 0, sy: 0, px: -1, py: -1 };
    let userYaw = 0, yawVel = 0, drag: { x: number } | null = null, dragMoved = false, finalOn = false, hovered: string | null = null;
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const isUI = (el: EventTarget | null) => !!(el as HTMLElement)?.closest?.("[data-ui],header,#top,#contact");
    const onMove = (e: PointerEvent) => {
      mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1;
      mouse.px = e.clientX; mouse.py = e.clientY;
      if (drag) { const dx = e.clientX - drag.x; drag.x = e.clientX; if (Math.abs(dx) > 1) dragMoved = true; yawVel = -dx * 0.004; userYaw += yawVel; }
    };
    const onDown = (e: PointerEvent) => { if (finalOn && e.pointerType === "mouse" && !isUI(e.target)) { drag = { x: e.clientX }; dragMoved = false; } };
    const onUp = () => { drag = null; };
    const onClick = (e: MouseEvent) => {
      if (!finalOn || dragMoved || isUI(e.target)) return;
      if (hovered) { const c = CASES.find((c) => c.state === hovered); if (c) { setSelected(selectedRef.current === c.slug ? null : c.slug); return; } }
      setSelected(null);
    };
    addEventListener("pointermove", onMove);
    addEventListener("pointerdown", onDown);
    addEventListener("pointerup", onUp);
    addEventListener("click", onClick);
    const onResize = () => {
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight, false);
      readScroll();
    };
    addEventListener("resize", onResize);

    /* ---------- loop ---------- */
    const tgt = new THREE.Vector3(), tmp = new THREE.Vector3();
    const project = (v: THREE.Vector3) => { tmp.copy(v).project(camera); return { x: ((tmp.x + 1) / 2) * innerWidth, y: ((1 - tmp.y) / 2) * innerHeight }; };
    let rendered = false, last = performance.now(), lastFilter = "", lastCardSlug: string | null = null, lastFinal = false, lastStop = -1, lastTip = "";

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const time = now / 1000;
      const fr = (r: number) => 1 - Math.pow(1 - r, dt * 60);
      readScroll();
      tCur += (tTarget - tCur) * (reduced ? 1 : 1 - Math.pow(0.0015, dt));
      const i = Math.min(Math.floor(tCur), N - 1);
      const f = ease(clamp((tCur - i - 0.22) / 0.56, 0, 1));
      const A = STOPS[i], B = STOPS[i + 1];
      const s = Math.round(tCur), S = STOPS[s];
      const mobile = innerWidth <= 720;
      const cE = ease(contactP);

      /* camera */
      tgt.lerpVectors(A.t, B.t, f);
      let dist = lerp(distFor(A), distFor(B), f);
      if (A.kind === "case" && B.kind === "case") dist += Math.sin(Math.PI * f) * 170;
      dist *= 1 + cE * 3.2; // pull away into space as the contact page arrives
      let phi = lerp(A.phi, B.phi, f), theta = lerp(A.theta, B.theta, f);
      const heroW = A.kind === "hero" ? 1 - f : 0, finalW = B.kind === "final" ? f : 0;
      finalOn = finalW > 0.9 && contactP < 0.15;
      if (!drag) { userYaw += yawVel; yawVel *= 0.92; }
      if (!finalOn) userYaw *= 0.94;
      mouse.sx += (mouse.x - mouse.sx) * fr(0.05); mouse.sy += (mouse.y - mouse.sy) * fr(0.05);
      theta += heroW * Math.sin(time * 0.18) * 0.14 + finalW * (userYaw + Math.sin(time * 0.12) * 0.06) + mouse.sx * 0.06 - cE * 0.25;
      phi = clamp(phi + mouse.sy * 0.04 - cE * 0.45, 0.12, 1.25);
      camera.position.set(tgt.x + dist * Math.sin(phi) * Math.sin(theta), tgt.y + dist * Math.cos(phi), tgt.z + dist * Math.sin(phi) * Math.cos(theta));
      camera.lookAt(tgt);
      const offOf = (st: Stop) => (st.kind === "case" ? 0.16 : st.offX ?? 0);
      const k = lerp(A.kind === "case" ? 1 : 0, B.kind === "case" ? 1 : 0, f);
      const ox = lerp(offOf(A), offOf(B), f) * (1 - cE);
      camera.setViewOffset(innerWidth, innerHeight, mobile ? 0 : ox * innerWidth, mobile ? (k * 0.2 + finalW * 0.12 * (1 - cE)) * innerHeight : 0, innerWidth, innerHeight);

      /* live case */
      const sel = selectedRef.current;
      const active = S.kind === "case" ? S.c! : finalOn && sel ? CASES.find((c) => c.slug === sel) ?? null : null;
      if (finalOn && mouse.px >= 0 && !drag) {
        ndc.set(mouse.x, -mouse.y); ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObjects(pickables, false)[0];
        hovered = hit ? (hit.object.userData.id as string) : null;
      } else hovered = null;
      const hoverState = finalOn ? chipHoverRef.current ?? hovered : null;
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
      CASES.forEach((c) => {
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

      /* depth-of-field on the canvas: blurred behind the home screen, blurred again as it pulls away */
      const blur = Math.round(10 * (1 - heroP) + cE * 7);
      const filter = blur > 0 ? `blur(${blur}px)` : "none";
      if (filter !== lastFilter) { canvas.style.filter = filter; lastFilter = filter; }
      const op = (1 - cE * 0.9).toFixed(2);
      if (canvas.style.opacity !== op) canvas.style.opacity = op;
      if (railRef.current) { const ra = heroP * (1 - contactP * 2); railRef.current.style.opacity = String(clamp(ra, 0, 1)); railRef.current.style.pointerEvents = ra > 0.5 ? "auto" : "none"; }

      /* card */
      let cardA = 0;
      if (S.kind === "case") cardA = clamp(1 - (Math.abs(tCur - s) - 0.2) / 0.12, 0, 1);
      else if (finalOn && sel) cardA = 1;
      cardA *= 1 - clamp(contactP * 4, 0, 1);
      const card = cardRef.current;
      const slug = active && cardA > 0 ? active.slug : lastCardSlug;
      if (slug !== lastCardSlug) { lastCardSlug = slug; setCardCase(CASES.find((c) => c.slug === slug) ?? null); }
      const isFinal = S.kind === "final";
      if (isFinal !== lastFinal) { lastFinal = isFinal; setCardIsFinal(isFinal); }
      if (card && active && cardA > 0) {
        const mm = markers[active.slug].m;
        const mp = project(tmp.set(mm.position.x, mm.position.y + 4, mm.position.z));
        const cw = card.offsetWidth, ch = card.offsetHeight;
        let ax: number, ay: number;
        if (mobile) {
          card.style.left = "16px"; card.style.top = `${innerHeight - 16 - ch}px`;
          card.style.transform = `translateY(${(1 - cardA) * 24}px)`;
          ax = innerWidth / 2; ay = innerHeight - 16 - ch;
        } else {
          let left = mp.x + 80, side = 1;
          if (left + cw > innerWidth - 80) { left = mp.x - 80 - cw; side = -1; }
          const top = clamp(mp.y - ch * 0.45, 96, innerHeight - ch - 24);
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
      const fA = clamp((tCur - (N - 0.3)) / 0.25, 0, 1) * (1 - clamp(contactP * 3, 0, 1));
      if (finalRef.current) {
        finalRef.current.style.opacity = String(fA);
        finalRef.current.style.transform = `translateY(${(1 - fA) * 30}px)`;
        finalRef.current.style.pointerEvents = fA > 0.5 ? "auto" : "none";
        finalRef.current.style.visibility = fA > 0.01 ? "visible" : "hidden";
      }
      CASES.forEach((c) => {
        const p = pinRefs.current[c.slug];
        if (!p) return;
        const show = fA > 0.5 && sel !== c.slug && !mobile;
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
        setTip(tipKey ? { name: states[tipKey].name, sub: c ? `${c.party ?? "Case study"} · click to open` : undefined } : null);
      }
      if (tipRef.current) tipRef.current.style.transform = `translate(${mouse.px + 16}px, ${mouse.py + 16}px)`;
      if (s !== lastStop) { lastStop = s; setActiveStop(s); }

      // skip GPU work while the opaque home screen fully covers the map, or once the contact page has taken over
      const visible = heroP > 0.35 && contactP < 0.999;
      if (visible || !rendered) { renderer.render(scene, camera); rendered = true; }
    };
    const stopLoop = rafLoop(frame);

    return () => {
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
  }, []);

  const leader = leaderById(cardCase?.leaderId);
  const tourIndex = cardCase ? TOUR.indexOf(cardCase) : -1;
  const labels = ["Home", ...TOUR.map((c) => c.label), "All India"];

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 z-0 block h-screen w-screen will-change-[filter]" aria-label="3D map of India with ReachOut Analytics campaigns" />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(120%_90%_at_50%_45%,transparent_45%,rgba(3,8,24,.8)_100%)]" aria-hidden />

      {/* leader line */}
      <svg ref={leaderRef} className="pointer-events-none fixed inset-0 z-[3] h-screen w-screen overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="lg" x1="0" x2="1"><stop offset="0" stopColor="#ffb866" /><stop offset="1" stopColor="#ffb866" stopOpacity=".3" /></linearGradient>
        </defs>
        <path ref={leaderPath} fill="none" stroke="url(#lg)" strokeWidth="1.5" strokeDasharray="4 5" />
        <circle ref={leaderDot} r="4" fill="#ff9933" />
      </svg>

      {/* small glass case card */}
      <div
        ref={cardRef}
        data-ui
        role="link"
        tabIndex={0}
        onClick={(e) => { if (!(e.target as HTMLElement).closest("[data-close]") && cardCase) router.push(caseUrl(cardCase.slug)); }}
        onKeyDown={(e) => { if (e.key === "Enter" && cardCase) router.push(caseUrl(cardCase.slug)); }}
        style={{ background: "linear-gradient(160deg, rgba(16,32,78,.92), rgba(6,14,38,.9))" }}
        className="glass invisible fixed left-0 top-0 z-[4] w-[calc(100vw-32px)] max-w-[300px] cursor-pointer rounded-2xl p-4 opacity-0 transition-[box-shadow] hover:shadow-[0_30px_80px_-10px_rgba(255,153,51,.35)] sm:w-[300px]"
      >
        <span className="tricolor-line absolute inset-x-5 top-0 h-px" aria-hidden />
        {cardCase && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full border border-saffron/40 bg-saffron/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-saffron-2">{cardCase.badge}</span>
              {cardIsFinal ? (
                <button data-close onClick={() => setSelected(null)} className="grid size-6 place-items-center rounded-full bg-white/10 text-white/70 hover:text-white" aria-label="Close"><X className="size-3.5" /></button>
              ) : (
                tourIndex >= 0 && <span className="text-[10px] font-semibold tracking-[0.16em] text-white/40">{String(tourIndex + 1).padStart(2, "0")} / {String(TOUR.length).padStart(2, "0")}</span>
              )}
            </div>
            <div className="mb-2.5 flex items-center gap-3">
              <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#2a5fc4] to-[#0b1f4d] shadow-[0_0_0_2px_rgba(255,255,255,.2),0_0_0_4px_rgba(255,153,51,.6)]">
                {leader?.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={leader.photo} alt={leader.name} className="absolute inset-x-0 bottom-0 h-[115%] w-full object-cover object-top" />
                ) : (
                  <span className="grid size-full place-items-center font-display text-sm font-bold text-saffron-2">{cardCase.party ?? cardCase.label.slice(0, 2)}</span>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-xl font-semibold leading-tight text-white">{cardCase.title}</h3>
                <p className="truncate text-xs text-white/55">
                  {cardCase.party && <b className="font-bold text-saffron-2">{cardCase.party}</b>}
                  {cardCase.party && " · "}
                  {cardCase.subtitle}
                </p>
              </div>
            </div>
            <p className="mb-3 text-[13px] leading-relaxed text-white/75">{cardCase.summary}</p>
            <div className="mb-3.5 flex flex-wrap gap-1.5">
              {cardCase.tags.map((t, i) => (
                <span key={t} className={cn("rounded-md px-2 py-1 text-[10.5px] font-semibold", i === 1 ? "bg-[#2fbf4a]/15 text-[#7ee08f]" : "bg-white/10 text-white/80")}>{t}</span>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
              View case study
              <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-saffron to-[#ff7a1a] text-[#07122e]"><ArrowUpRight className="size-4" /></span>
            </div>
          </>
        )}
      </div>

      {/* progress rail */}
      <nav ref={railRef} data-ui className="fixed right-6 top-1/2 z-[3] hidden -translate-y-1/2 flex-col gap-3.5 opacity-0 md:flex" aria-label="Map sections">
        {labels.map((label, i) => (
          <button key={label} onClick={() => scrollToStop(i)} className="group flex items-center justify-end gap-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
            <span className={cn("translate-x-1.5 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100", activeStop === i && "translate-x-0 text-white opacity-100")}>{label}</span>
            <i className={cn("block size-2 rounded-full bg-white/30 transition-all duration-300", activeStop === i && "h-6 rounded-md bg-saffron shadow-[0_0_0_4px_rgba(255,153,51,.2),0_0_16px_rgba(255,153,51,.8)]")} />
          </button>
        ))}
      </nav>

      {/* zoomed-out panel */}
      <div ref={finalRef} data-ui className="invisible fixed bottom-6 left-4 right-4 z-[3] opacity-0 sm:bottom-10 sm:left-[5vw] sm:right-auto sm:max-w-[470px]">
        <div className="text-[11px] font-bold uppercase tracking-[0.26em] text-saffron-2">Pan-India footprint</div>
        <h2 className="mb-4 mt-3 font-display text-[clamp(28px,3.4vw,46px)] font-semibold leading-[1.02] tracking-[-0.03em]">
          We don&apos;t just predict elections — <span className="text-gradient-saffron font-serif font-normal italic">we influence outcomes.</span>
        </h2>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {CASES.map((c) => (
            <button
              key={c.slug}
              onClick={() => setSelected(selected === c.slug ? null : c.slug)}
              onMouseEnter={() => (chipHoverRef.current = c.state)}
              onMouseLeave={() => (chipHoverRef.current = null)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[12.5px] font-semibold backdrop-blur-xl transition hover:border-saffron/60 hover:bg-saffron/15",
                selected === c.slug && "border-saffron/70 bg-saffron/20",
              )}
            >
              <i className={cn("size-1.5 rounded-full", c.tour ? "bg-saffron shadow-[0_0_8px_#ff9933]" : "bg-[#2fbf4a] shadow-[0_0_8px_#2fbf4a]")} />
              {c.label}
            </button>
          ))}
        </div>
        <div className="mb-5 hidden flex-wrap items-center gap-2 text-xs text-white/45 sm:flex">
          Next up:
          {UPCOMING.map((u) => (
            <a key={u.slug} href={caseUrl(u.slug)} className="rounded-md border border-dashed border-saffron/50 px-2.5 py-1 font-semibold text-white hover:bg-saffron/10">{u.title}</a>
          ))}
        </div>
        <div className="glass flex items-center justify-between gap-4 rounded-2xl py-2.5 pl-5 pr-2.5">
          <p className="font-display text-[15px] font-semibold leading-tight">Partner with us <span className="font-normal text-white/60">for your next election victory</span></p>
          <ShimmerButton text="Book a Consultation" duration={2} onClick={() => router.push("/#contact")} className="shrink-0 border-white/15 px-5 py-2.5 dark:bg-[#0a1a44]/80 backdrop-blur-xl" />
        </div>
        <p className="mt-3 hidden text-[10.5px] uppercase tracking-[0.16em] text-white/35 sm:block">Drag to rotate · Hover a state · Click a campaign</p>
      </div>

      {/* labels over markers in the zoomed-out view */}
      {CASES.map((c) => (
        <button
          key={c.slug}
          ref={(el) => { pinRefs.current[c.slug] = el; }}
          data-ui
          onClick={() => setSelected(c.slug)}
          className="glass fixed left-0 top-0 z-[3] whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold opacity-0 transition-opacity"
          style={{ pointerEvents: "none" }}
        >
          {c.label}
        </button>
      ))}

      <div ref={tipRef} className={cn("pointer-events-none fixed left-0 top-0 z-[5] whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-opacity glass", tip ? "opacity-100" : "opacity-0")}>
        {tip?.name}
        {tip?.sub && <small className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] text-saffron-2">{tip.sub}</small>}
      </div>
    </>
  );
}
