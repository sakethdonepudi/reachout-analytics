import states from "@/lib/data/india-states.json";

export type IndiaState = { id: string; name: string; d: string };

export const INDIA_STATES = states as IndiaState[];

type Box = { minX: number; minY: number; maxX: number; maxY: number };

const TOKEN = /([a-zA-Z])|(-?(?:\d+\.\d*|\.\d+|\d+)(?:e[-+]?\d+)?)/gi;

/** The source paths are polygons built from m, l, L and z only. */
export function pathBounds(d: string): Box {
  let x = 0, y = 0, startX = 0, startY = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let command = "";
  let firstMove = true;
  const numbers: number[] = [];
  const add = (px: number, py: number) => {
    minX = Math.min(minX, px); maxX = Math.max(maxX, px);
    minY = Math.min(minY, py); maxY = Math.max(maxY, py);
  };
  const flush = () => {
    if (!numbers.length) return;
    if (command === "m" || command === "l" || command === "L") {
      for (let i = 0; i + 1 < numbers.length; i += 2) {
        const nx = numbers[i], ny = numbers[i + 1];
        if (command === "m") {
          if (firstMove) { x = nx; y = ny; firstMove = false; }
          else { x += nx; y += ny; }
          startX = x; startY = y;
        } else if (command === "l") {
          x += nx; y += ny;
        } else {
          x = nx; y = ny;
        }
        add(x, y);
      }
    }
    numbers.length = 0;
  };
  for (const match of d.matchAll(TOKEN)) {
    if (match[1]) {
      flush();
      command = match[1];
      if (command === "z" || command === "Z") { x = startX; y = startY; }
    } else {
      numbers.push(Number(match[2]));
    }
  }
  flush();
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

const stateBounds = new Map(INDIA_STATES.map((state) => [state.id, pathBounds(state.d)]));

export const INDIA_BOUNDS: Box = INDIA_STATES.reduce<Box>((box, state) => {
  const b = stateBounds.get(state.id)!;
  return { minX: Math.min(box.minX, b.minX), minY: Math.min(box.minY, b.minY), maxX: Math.max(box.maxX, b.maxX), maxY: Math.max(box.maxY, b.maxY) };
}, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

export function viewBoxFor(stateId: string, padding = 0.16): string {
  const b = stateBounds.get(stateId);
  if (!b) {
    const w = INDIA_BOUNDS.maxX - INDIA_BOUNDS.minX;
    const h = INDIA_BOUNDS.maxY - INDIA_BOUNDS.minY;
    return `${INDIA_BOUNDS.minX} ${INDIA_BOUNDS.minY} ${w} ${h}`;
  }
  const w = Math.max(1, b.maxX - b.minX);
  const h = Math.max(1, b.maxY - b.minY);
  const pad = Math.max(w, h) * padding;
  return `${b.minX - pad} ${b.minY - pad} ${w + pad * 2} ${h + pad * 2}`;
}

export function indiaViewBox(padding = 0.02): string {
  const w = INDIA_BOUNDS.maxX - INDIA_BOUNDS.minX;
  const h = INDIA_BOUNDS.maxY - INDIA_BOUNDS.minY;
  const pad = Math.max(w, h) * padding;
  return `${INDIA_BOUNDS.minX - pad} ${INDIA_BOUNDS.minY - pad} ${w + pad * 2} ${h + pad * 2}`;
}

export const PARTY_FILL: Record<string, string> = {
  TDP: "#eab308",
  AIADMK: "#16a34a",
  BRS: "#ec4899",
  BJP: "#f58a24",
  "JD(U)": "#2563eb",
  INC: "#2563eb",
};

export const NORTH_EAST_STATES = ["as", "ar", "mn", "ml", "mz", "nl", "tr", "sk"];

export function stateName(id: string): string {
  return INDIA_STATES.find((state) => state.id === id)?.name ?? id.toUpperCase();
}
