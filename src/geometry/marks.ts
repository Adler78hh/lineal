import { frameSides } from './frame';
import { onSegment } from './segments';
import type { Task } from './task';
import { type Vec, dist, samePoint, sub, vec } from './vec';

/**
 * Where a mark for grid point `p` goes: across the frame or a given line, as a short stroke
 * (`out`: pointing away from the frame; both ways: crossing a line). Null: show a dot.
 */
export function markDirection(task: Task, p: Vec): { dir: Vec; both: boolean } | null {
  const f = task.frame;
  if (f.kind === 'circle' && Math.abs(dist(p, f.center) - f.r) < 1e-6) {
    const d = sub(p, f.center);
    return { dir: vec(d.x / f.r, d.y / f.r), both: !f.visible };
  }
  if (f.kind === 'polygon') {
    if (f.vertices.some((v) => samePoint(v, p))) return { dir: vec(0, 0), both: false };
    const side = frameSides(f).find((s) => onSegment(s, p));
    if (side) {
      const d = sub(side.b, side.a);
      const l = Math.hypot(d.x, d.y);
      return { dir: vec(d.y / l, -d.x / l), both: false };
    }
  }
  const line = task.givenLines.find((s) => onSegment(s, p));
  if (line) {
    const d = sub(line.b, line.a);
    const l = Math.hypot(d.x, d.y);
    return { dir: vec(-d.y / l, d.x / l), both: true };
  }
  return null;
}
