import { segmentIntersection } from './intersect';
import { collinear, onSegment } from './segments';
import type { Frame } from './task';
import { EPS, type Segment, type Vec, cross, dist, dot, sub, tidy, uniquePoints } from './vec';

export function frameSides(f: Frame & { kind: 'polygon' }): Segment[] {
  return f.vertices.map((a, i) => ({ a, b: f.vertices[(i + 1) % f.vertices.length] }));
}

/** Is `p` inside the frame or on its border? */
export function insideFrame(f: Frame, p: Vec, tol = EPS): boolean {
  if (f.kind === 'circle') return dist(p, f.center) <= f.r + tol;
  if (frameSides(f).some((s) => onSegment(s, p, tol))) return true;
  // Ray casting, for any simple polygon.
  let inside = false;
  const v = f.vertices;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    if (v[i].y > p.y !== v[j].y > p.y && p.x < ((v[j].x - v[i].x) * (p.y - v[i].y)) / (v[j].y - v[i].y) + v[i].x) inside = !inside;
  }
  return inside;
}

/** Where `s` crosses or touches the frame border. */
export function frameCrossings(s: Segment, f: Frame): Vec[] {
  if (f.kind === 'circle') {
    // |a + u·d − c|² = r²
    const d = sub(s.b, s.a);
    const w = sub(s.a, f.center);
    const A = dot(d, d);
    const B = 2 * dot(w, d);
    const C = dot(w, w) - f.r * f.r;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return [];
    const root = Math.sqrt(disc);
    return uniquePoints(
      [(-B - root) / (2 * A), (-B + root) / (2 * A)]
        .filter((u) => u >= -EPS && u <= 1 + EPS)
        .map((u) => ({ x: tidy(s.a.x + u * d.x), y: tidy(s.a.y + u * d.y) })),
    );
  }
  const out: Vec[] = [];
  for (const side of frameSides(f)) {
    const x = segmentIntersection(s, side);
    if (x) out.push(x);
    else if (Math.abs(cross(sub(s.b, s.a), sub(side.b, side.a))) < EPS && collinear(s, side))
      out.push(...[side.a, side.b].filter((p) => onSegment(s, p)));
  }
  return uniquePoints(out);
}
