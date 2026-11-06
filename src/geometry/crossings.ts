import { frameCrossings } from './frame';
import { segmentIntersection } from './intersect';
import { pointKey } from './segments';
import type { Frame, Task } from './task';
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

/**
 * Every point a child may tap to make a new grid point: where drawn lines cross or meet, and
 * where a drawn line crosses or touches the frame, a given line or a given circle.
 * Points in `known` are left out.
 */
export function tapPoints(pieces: readonly Segment[], task: Task, known: readonly Vec[]): Vec[] {
  const out = [...crossingPoints(pieces, known)];
  const keys = new Set([...known, ...out].map(pointKey));
  const add = (p: Vec) => {
    const k = pointKey(p);
    if (keys.has(k) || known.some((q) => samePoint(p, q))) return;
    keys.add(k);
    out.push(p);
  };
  const circles: Frame[] = task.givenCircles.map((c) => ({ kind: 'circle', center: c.center, r: c.r, points: [], visible: true }));
  for (const s of pieces) {
    for (const p of frameCrossings(s, task.frame)) add(p);
    for (const c of circles) for (const p of frameCrossings(s, c)) add(p);
    for (const g of task.givenLines) {
      const x = segmentIntersection(s, g);
      if (x) add(x);
    }
  }
  return out;
}
