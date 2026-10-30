/** A point or direction in task coordinates (origin bottom left, y up). */
export interface Vec {
  x: number;
  y: number;
}

/** Tolerance for comparing task coordinates. */
export const EPS = 1e-6;

export const vec = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const samePoint = (a: Vec, b: Vec, tol = EPS): boolean => dist(a, b) <= tol;

/** Removes float noise such as 5.999999999 from computed coordinates. */
export function tidy(n: number): number {
  const r = Math.round(n);
  return Math.abs(n - r) < 1e-9 ? r + 0 : n; // + 0 turns -0 into 0
}

/** Keeps the first of several points that lie on top of each other. */
export function uniquePoints(points: readonly Vec[], tol = EPS): Vec[] {
  const out: Vec[] = [];
  for (const p of points) if (!out.some((q) => samePoint(p, q, tol))) out.push(p);
  return out;
}

export interface Segment {
  a: Vec;
  b: Vec;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsOf(points: readonly Vec[]): Bounds {
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}
