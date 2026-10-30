import { segmentIntersection } from './intersect';
import { EPS, type Segment, type Vec, cross, dist, dot, len, samePoint, sub, uniquePoints } from './vec';

/** Position of `p` along `s`: 0 at `a`, 1 at `b` (projected). */
export function paramOn(s: Segment, p: Vec): number {
  const d = sub(s.b, s.a);
  return dot(sub(p, s.a), d) / dot(d, d);
}

/** Is `p` on the segment (within `tol`)? */
export function onSegment(s: Segment, p: Vec, tol = EPS): boolean {
  const d = sub(s.b, s.a);
  const l = len(d);
  if (l < EPS) return dist(p, s.a) <= tol;
  const t = paramOn(s, p);
  return t >= -tol / l && t <= 1 + tol / l && Math.abs(cross(d, sub(p, s.a))) / l <= tol;
}

/** Do `s` and `t` lie on one straight line? */
export function collinear(s: Segment, t: Segment): boolean {
  const d = sub(s.b, s.a);
  const l = len(d);
  return Math.abs(cross(d, sub(t.a, s.a))) / l <= EPS && Math.abs(cross(d, sub(t.b, s.a))) / l <= EPS;
}

export const sameSegment = (s: Segment, t: Segment): boolean =>
  (samePoint(s.a, t.a) && samePoint(s.b, t.b)) || (samePoint(s.a, t.b) && samePoint(s.b, t.a));

/** Cuts `s` at every point of `cuts` that lies inside it. */
export function splitAt(s: Segment, cuts: readonly Vec[]): Segment[] {
  const inner = uniquePoints(cuts.filter((p) => onSegment(s, p) && !samePoint(p, s.a) && !samePoint(p, s.b)));
  const stops = [s.a, ...inner.sort((p, q) => paramOn(s, p) - paramOn(s, q)), s.b];
  const out: Segment[] = [];
  for (let i = 1; i < stops.length; i++) if (!samePoint(stops[i - 1], stops[i])) out.push({ a: stops[i - 1], b: stops[i] });
  return out;
}

function unique(pieces: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const s of pieces) if (!out.some((t) => sameSegment(s, t))) out.push(s);
  return out;
}

/**
 * Adds `line` to the drawing. The drawing is kept as pieces that end at every grid point,
 * every crossing and every end of another line, so the eraser can take exactly one piece.
 * Drawing over an existing line adds nothing twice.
 */
export function addLine(pieces: readonly Segment[], line: Segment, points: readonly Vec[]): Segment[] {
  const lineCuts: Vec[] = points.filter((p) => onSegment(line, p));
  const out: Segment[] = [];
  for (const piece of pieces) {
    const pieceCuts: Vec[] = [];
    const x = segmentIntersection(piece, line);
    if (x) {
      lineCuts.push(x);
      pieceCuts.push(x);
    } else if (collinear(piece, line)) {
      lineCuts.push(piece.a, piece.b);
      pieceCuts.push(line.a, line.b);
    }
    out.push(...splitAt(piece, pieceCuts));
  }
  out.push(...splitAt(line, lineCuts));
  return unique(out);
}

/** Cuts the pieces at new grid points (e.g. a crossing that became a grid point). */
export const splitAtPoints = (pieces: readonly Segment[], points: readonly Vec[]): Segment[] =>
  unique(pieces.flatMap((s) => splitAt(s, points)));

/** Distance from `p` to the nearest point of `s`. */
export function distToSegment(s: Segment, p: Vec): number {
  const t = Math.min(Math.max(paramOn(s, p), 0), 1);
  const d = sub(s.b, s.a);
  return dist(p, { x: s.a.x + t * d.x, y: s.a.y + t * d.y });
}
