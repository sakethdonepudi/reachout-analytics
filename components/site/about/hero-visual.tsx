import type { CSSProperties } from "react";

/*
 * The opening sequence: scattered dots settle onto contour lines, the lines
 * draw, and the geometric ReachOut R assembles. It is pure SVG + CSS, plays
 * once and then holds a still frame. Reduced-motion visitors get that frame
 * immediately.
 */

const DOTS: Array<{ x: number; y: number; sx: number; sy: number; d: number; lime?: boolean }> = [
  { x: 108, y: 300, sx: -46, sy: 54, d: 0 },
  { x: 150, y: 330, sx: 28, sy: 62, d: 60 },
  { x: 202, y: 312, sx: -22, sy: -58, d: 120 },
  { x: 252, y: 320, sx: 52, sy: 38, d: 180, lime: true },
  { x: 300, y: 296, sx: -58, sy: 20, d: 240 },
  { x: 350, y: 272, sx: 34, sy: -46, d: 300 },
  { x: 402, y: 258, sx: -38, sy: -30, d: 360, lime: true },
  { x: 450, y: 282, sx: 54, sy: 44, d: 420 },
  { x: 92, y: 354, sx: -34, sy: 30, d: 100 },
  { x: 178, y: 368, sx: 42, sy: 54, d: 160 },
  { x: 240, y: 352, sx: -52, sy: 24, d: 220 },
  { x: 300, y: 340, sx: 48, sy: -36, d: 280 },
  { x: 362, y: 316, sx: -30, sy: 56, d: 340 },
  { x: 420, y: 302, sx: 40, sy: 34, d: 400 },
];

const PIECES = [
  { d: "M8 0H187C241 0 274 32 274 78C274 112 260 137 235 153L194 107C206 102 212 92 212 81C212 66 202 58 186 58H59Z", rx: -28, ry: -22, delay: 0 },
  { d: "M88 90H157L290 268H210Z", rx: 34, ry: -16, delay: 90 },
  { d: "M4 199L78 135V190L4 253Z", rx: -32, ry: 28, delay: 170 },
];

export default function AboutHeroVisual() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[42px] bg-[radial-gradient(circle_at_58%_42%,var(--about-blue-soft),transparent_62%)] blur-2xl" aria-hidden />
      <div className="about-seq relative overflow-hidden rounded-[30px] border border-[color:var(--about-blue-line)] bg-[color:var(--about-panel)] p-2 shadow-[0_30px_80px_-46px_rgba(8,6,62,.45)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(var(--about-grid) 1px, transparent 1px), linear-gradient(90deg, var(--about-grid) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
          aria-hidden
        />
        <svg
          viewBox="0 0 520 520"
          fill="none"
          className="relative h-auto w-full"
          role="img"
          aria-labelledby="about-hero-visual-title about-hero-visual-desc"
        >
          <title id="about-hero-visual-title">ReachOut data sequence</title>
          <desc id="about-hero-visual-desc">
            Scattered data points gather along geographic contour lines and resolve into the geometric ReachOut R mark.
          </desc>
          <defs>
            <radialGradient id="about-seq-glow" cx="0" cy="0" r="1" gradientTransform="translate(260 260) rotate(90) scale(220)" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--about-lime)" stopOpacity=".22" />
              <stop offset="1" stopColor="var(--about-lime)" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx="260" cy="260" r="220" fill="url(#about-seq-glow)" className="seq-glow" />

          <g className="seq-contours" stroke="var(--about-blue)" strokeWidth="1.2" fill="none">
            {[
              "M18 286C96 204 148 336 242 252S396 148 506 234",
              "M18 318C104 236 154 368 254 284S410 180 506 266",
              "M18 350C112 268 166 400 266 316S424 214 506 300",
              "M18 382C120 300 178 432 278 348S438 248 506 334",
            ].map((d, i) => (
              <path
                key={d}
                d={d}
                pathLength="1"
                className="seq-contour"
                style={{ "--d": `${i * 90}ms` } as CSSProperties}
                opacity=".34"
              />
            ))}
          </g>

          <g>
            {DOTS.map((dot, i) => (
              <g key={`${dot.x}-${dot.y}`}>
                <circle cx={dot.x} cy={dot.y} r={dot.lime ? 5 : 3.6} fill={dot.lime ? "var(--about-lime)" : "var(--about-blue)"} className="seq-dot" style={{ "--sx": `${dot.sx}px`, "--sy": `${dot.sy}px`, "--d": `${dot.d}ms` } as CSSProperties} />
                {dot.lime && <circle cx={dot.x} cy={dot.y} r="14" stroke="var(--about-lime)" strokeWidth="1" opacity=".28" className="seq-dot" style={{ "--sx": `${dot.sx}px`, "--sy": `${dot.sy}px`, "--d": `${dot.d}ms` } as CSSProperties} />}
                {i === 3 && <circle cx="260" cy="260" r="190" stroke="var(--about-blue)" strokeWidth="1" strokeDasharray="2 12" opacity=".18" />}
              </g>
            ))}
          </g>

          <g transform="translate(62 79) scale(1.35)">
            {PIECES.map((piece) => (
              <path
                key={piece.d}
                d={piece.d}
                fill="var(--about-blue)"
                className="seq-piece"
                style={{ "--rx": `${piece.rx}px`, "--ry": `${piece.ry}px`, "--d": `${1750 + piece.delay}ms` } as CSSProperties}
              />
            ))}
            <path
              d="M4 268L78 203V268Z"
              fill="var(--about-lime)"
              className="seq-piece"
              style={{ "--rx": "-22px", "--ry": "34px", "--d": "2120ms" } as CSSProperties}
            />
          </g>

          <g className="seq-labels" fill="var(--about-blue)" fontSize="9" fontWeight="700" letterSpacing="2.2">
            <text x="18" y="472" opacity=".55">COLLECT</text>
            <text x="18" y="486" opacity=".28">ANALYSE · EXPLAIN</text>
            <text x="502" y="472" textAnchor="end" opacity=".55">REACHOUT</text>
            <text x="502" y="486" textAnchor="end" opacity=".28">ANALYTICS</text>
          </g>
        </svg>
      </div>
    </div>
  );
}
