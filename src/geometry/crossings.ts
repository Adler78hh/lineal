import { EPS, type Segment, type Vec, cross, len, samePoint, sub, uniquePoints } from './vec';

/**
 * Points where drawn lines cross or meet at an angle (also a T or an L), found at the ends
 * of the pieces – the drawing is already cut there. Points in `known` are left out.
 */
export function crossingPoints(pieces: readonly Segment[], known: readonly Vec[]): Vec[] {
  const ends = uniquePoints(pieces.flatMap((s) => [s.a, s.b]));
  return ends.filter((p) => {
    if (known.some((q) => samePoint(p, q))) return false;
    const dirs = pieces
      .filter((s) => samePoint(s.a, p) || samePoint(s.b, p))
      .map((s) => {
        const d = sub(s.b, s.a);
        return { x: d.x / len(d), y: d.y / len(d) };
      });
    return dirs.some((d, i) => dirs.slice(i + 1).some((e) => Math.abs(cross(d, e)) > EPS));
  });
}
