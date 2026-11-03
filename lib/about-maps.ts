import { geoIdentity, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import TN_DISTRICTS from "@/lib/data/tamil-nadu/tn-districts.json";
// Server-side copy of public/telangana/telangana-districts.geojson. The public
// file is still the source used by the live Telangana dashboard.
import TG_DISTRICTS from "@/lib/data/telangana-districts.json";

/*
 * Lightweight geography for the About page. The full case-study dashboards
 * project the same data in WebGL; here we only need flat SVG paths, generated
 * once on the server. Rings are simplified to about one pixel so the previews
 * stay small without loading a dashboard.
 */

type DistrictProperties = {
  district?: string;
  group?: string;
  name?: string;
};

export type MapShape = {
  d: string;
  name: string;
  tone: number;
  highlight: boolean;
  cx: number;
  cy: number;
};

export type MapPreview = {
  shapes: MapShape[];
  width: number;
  height: number;
};

const WIDTH = 560;
const HEIGHT = 400;
const PAD = 28;
const SIMPLIFY_PX = 1;

const TN_HIGHLIGHTS = new Set(["Chennai", "Coimbatore", "Madurai"]);
const TG_HIGHLIGHTS = new Set(["Hyderabad", "Warangal", "Khammam"]);

type Point = [number, number];

function squaredSegmentDistance(point: Point, start: Point, end: Point) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = end[0];
      y = end[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

/** Ramer–Douglas–Peucker, in projected pixel space. */
function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length <= 4) return points;

  const limit = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];

  while (stack.length) {
    const [first, last] = stack.pop() as [number, number];
    let furthest = limit;
    let index = -1;

    for (let i = first + 1; i < last; i += 1) {
      const distance = squaredSegmentDistance(points[i], points[first], points[last]);
      if (distance > furthest) {
        furthest = distance;
        index = i;
      }
    }

    if (index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  const result: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    if (keep[i]) result.push(points[i]);
  }
  result.push(points[points.length - 1]);
  return result;
}

function round(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function ringToPath(ring: Point[]) {
  return `M${ring.map(([x, y]) => `${round(x)},${round(y)}`).join("L")}Z`;
}

function geometryToPath(
  geometry: Geometry,
  project: (point: [number, number]) => Point,
): string {
  if (geometry.type === "Polygon") {
    return geometry.coordinates
      .map((ring) => simplify(ring.map(([lng, lat]) => project([lng, lat])), SIMPLIFY_PX))
      .map((ring) => (ring.length > 2 ? ringToPath(ring) : ""))
      .join("");
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .flatMap((polygon) =>
        polygon
          .map((ring) => simplify(ring.map(([lng, lat]) => project([lng, lat])), SIMPLIFY_PX))
          .map((ring) => (ring.length > 2 ? ringToPath(ring) : "")),
      )
      .join("");
  }

  return "";
}

function buildMap(
  collection: FeatureCollection<Geometry, DistrictProperties>,
  highlights: Set<string>,
): MapPreview {
  const projection = geoIdentity()
    .reflectY(true)
    .fitExtent(
      [
        [PAD, PAD],
        [WIDTH - PAD, HEIGHT - PAD],
      ],
      collection,
    );
  const project = (point: [number, number]) => projection(point) as Point;
  const centroidPath = geoPath(projection);

  const shapes: MapShape[] = [];
  collection.features.forEach((feature, index) => {
    const d = geometryToPath(feature.geometry, project);
    if (!d) return;
    const [cx, cy] = centroidPath.centroid(feature);
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
    const name = feature.properties?.district ?? feature.properties?.group ?? feature.properties?.name ?? "";
    shapes.push({
      d,
      name,
      tone: (index * 3 + 1) % 4,
      highlight: highlights.has(name),
      cx,
      cy,
    });
  });

  return { shapes, width: WIDTH, height: HEIGHT };
}

export const TAMIL_NADU_MAP = buildMap(
  TN_DISTRICTS as unknown as FeatureCollection<Geometry, DistrictProperties>,
  TN_HIGHLIGHTS,
);

export const TELANGANA_MAP = buildMap(
  TG_DISTRICTS as unknown as FeatureCollection<Geometry, DistrictProperties>,
  TG_HIGHLIGHTS,
);
