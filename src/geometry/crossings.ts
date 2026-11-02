import { pointKey } from './segments';
import { EPS, type Segment, type Vec, cross, len, samePoint, sub } from './vec';

/**
 * Points where drawn lines cross or meet at an angle (also a T or an L), found at the ends
 * of the pieces – the drawing is already cut there. Points in `known` are left out.
 */
export function crossingPoints(pieces: readonly Segment[], known: readonly Vec[]): Vec[] {
  // Directions of the pieces leaving each end point, gathered in one pass.
  const at = new Map<string, { p: Vec; dirs: Vec[] }>();
  for (const s of pieces) {
    const d = sub(s.b, s.a);
    const u = { x: d.x / len(d), y: d.y / len(d) };
    for (const p of [s.a, s.b]) {
      const key = pointKey(p);
      const entry = at.get(key) ?? { p, dirs: [] };
      entry.dirs.push(u);
      at.set(key, entry);
    }
  }
  const knownKeys = new Set(known.map(pointKey));
  const out: Vec[] = [];
  for (const [key, { p, dirs }] of at) {
    if (knownKeys.has(key) || known.some((q) => samePoint(p, q))) continue;
    if (dirs.some((d, i) => dirs.slice(i + 1).some((e) => Math.abs(cross(d, e)) > EPS))) out.push(p);
  }
  return out;
}
