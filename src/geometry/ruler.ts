import { EPS, type Vec, add, cross, dist, dot, scale, sub, vec } from './vec';

/**
 * Position of the ruler in task coordinates. `origin` is the middle of the drawing edge,
 * `angle` the direction of that edge (radians, counter-clockwise). The body of the ruler
 * lies to the left of the edge direction, so at angle 0 the drawing edge is the bottom edge.
 */
export interface RulerPose {
  origin: Vec;
  angle: number;
}

/** Size in task units. Long enough to draw the diagonal of a 12 × 12 frame in one go. */
export const RULER = { length: 18, width: 1.8 };

export const rulerDir = (r: RulerPose): Vec => vec(Math.cos(r.angle), Math.sin(r.angle));
/** Points from the drawing edge into the body. */
export const rulerNormal = (r: RulerPose): Vec => vec(-Math.sin(r.angle), Math.cos(r.angle));

/** Keeps an angle in (-π, π]. */
export function normAngle(a: number): number {
  const t = a % (2 * Math.PI);
  if (t > Math.PI) return t - 2 * Math.PI;
  if (t <= -Math.PI) return t + 2 * Math.PI;
  return t;
}

/** `t`: position along the edge measured from its middle, `d`: signed distance from the edge (positive towards the body). */
export function edgeCoords(r: RulerPose, p: Vec): { t: number; d: number } {
  const w = sub(p, r.origin);
  return { t: dot(w, rulerDir(r)), d: dot(w, rulerNormal(r)) };
}

/**
 * Is `p` at most `tol` away from the straight line of the drawing edge?
 * The line counts beyond the ends of the ruler: a short ruler turned around a point near
 * its middle should still reach the far corner of the frame (all grid points are in the frame).
 */
export function nearEdge(r: RulerPose, p: Vec, tol: number): boolean {
  return Math.abs(edgeCoords(r, p).d) <= tol;
}

export const translateRuler = (r: RulerPose, v: Vec): RulerPose => ({ origin: add(r.origin, v), angle: r.angle });

export function rotatePoint(p: Vec, pivot: Vec, delta: number): Vec {
  const c = Math.cos(delta);
  const s = Math.sin(delta);
  const w = sub(p, pivot);
  return vec(pivot.x + c * w.x - s * w.y, pivot.y + s * w.x + c * w.y);
}

export const rotateRuler = (r: RulerPose, pivot: Vec, delta: number): RulerPose => ({
  origin: rotatePoint(r.origin, pivot, delta),
  angle: normAngle(r.angle + delta),
});

/** Outline of the ruler: the two ends of the drawing edge, then the far side. */
export function rulerCorners(r: RulerPose): Vec[] {
  const half = scale(rulerDir(r), RULER.length / 2);
  const up = scale(rulerNormal(r), RULER.width);
  const a = sub(r.origin, half);
  const b = add(r.origin, half);
  return [a, b, add(b, up), add(a, up)];
}

/** Point on the ruler at position `t` along the edge and `d` into the body. */
export const rulerPoint = (r: RulerPose, t: number, d: number): Vec =>
  add(r.origin, add(scale(rulerDir(r), t), scale(rulerNormal(r), d)));

export interface Snap {
  pose: RulerPose;
  /** Grid points that lie exactly on the drawing edge now. */
  points: Vec[];
}

/** Turns `r` around `pivot` (which lies on the edge) by the smaller angle that puts `q` on the edge too. */
export function turnOnto(r: RulerPose, pivot: Vec, q: Vec): RulerPose {
  const w = sub(q, pivot);
  let phi = Math.atan2(cross(rulerDir(r), w), dot(rulerDir(r), w));
  if (phi > Math.PI / 2) phi -= Math.PI;
  else if (phi < -Math.PI / 2) phi += Math.PI;
  return rotateRuler(r, pivot, phi);
}

function nearest(r: RulerPose, points: readonly Vec[], tol: number, skip?: Vec | null): { p: Vec; d: number } | null {
  let best: { p: Vec; d: number } | null = null;
  for (const p of points) {
    if (skip && dist(p, skip) <= EPS) continue;
    if (!nearEdge(r, p, tol)) continue;
    const { d } = edgeCoords(r, p);
    if (!best || Math.abs(d) < Math.abs(best.d)) best = { p, d };
  }
  return best;
}

/**
 * Magnetic grid points: if a point is less than `tol` from the drawing edge, the ruler is
 * shifted so the edge runs exactly through it. If a second point is then also within `tol`,
 * the ruler is turned around the first one until it runs through both.
 */
export function snapRuler(free: RulerPose, points: readonly Vec[], tol: number): Snap {
  const first = nearest(free, points, tol);
  if (!first) return { pose: free, points: [] };
  let pose = translateRuler(free, scale(rulerNormal(free), first.d));
  const second = nearest(pose, points, tol, first.p);
  if (second) pose = turnOnto(pose, first.p, second.p);
  return { pose, points: pointsOnEdge(pose, points) };
}

/** All points that lie exactly on the drawing edge. */
export const pointsOnEdge = (r: RulerPose, points: readonly Vec[]): Vec[] => points.filter((p) => nearEdge(r, p, 1e-6));

/**
 * Snapping while the ruler turns around `pivot` (a point on its edge): it cannot shift,
 * but if another point comes within `tol` of the edge, it turns onto it.
 */
export function snapAroundPivot(r: RulerPose, pivot: Vec, points: readonly Vec[], tol: number): Snap {
  const other = nearest(r, points, tol, pivot);
  const pose = other ? turnOnto(r, pivot, other.p) : r;
  return { pose, points: pointsOnEdge(pose, points) };
}
