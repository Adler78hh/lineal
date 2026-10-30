import { EPS, type Segment, type Vec, cross, sub, tidy } from './vec';

/**
 * The single point where two segments cross or touch, ends included.
 * Parallel segments (also overlapping ones) have none.
 */
export function segmentIntersection(s: Segment, t: Segment): Vec | null {
  const r = sub(s.b, s.a);
  const q = sub(t.b, t.a);
  const d = cross(r, q);
  if (Math.abs(d) < EPS) return null;
  const w = sub(t.a, s.a);
  const u = cross(w, q) / d;
  const v = cross(w, r) / d;
  const tol = 1e-9;
  if (u < -tol || u > 1 + tol || v < -tol || v > 1 + tol) return null;
  return { x: tidy(s.a.x + u * r.x), y: tidy(s.a.y + u * r.y) };
}
