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
  const circle = task.givenCircles.find((c) => Math.abs(dist(p, c.center) - c.r) < 1e-6);
  if (circle) {
    const d = sub(p, circle.center);
    return { dir: vec(d.x / circle.r, d.y / circle.r), both: false };
  }
  const line = task.givenLines.find((s) => onSegment(s, p));
  if (line) {
    const d = sub(line.b, line.a);
    const l = Math.hypot(d.x, d.y);
    return { dir: vec(-d.y / l, d.x / l), both: true };
  }
  return null;
}

/**
 * Where a point's name goes: away from the middle of the figure, so names around a circle or
 * along the sides sit outside. A point in the middle gets its name above it.
 */
export function labelDirection(task: Task, p: Vec): Vec {
  const b = task.bounds;
  const dx = p.x - (b.minX + b.maxX) / 2;
  const dy = p.y - (b.minY + b.maxY) / 2;
  const d = Math.hypot(dx, dy);
  const away = d < 1e-6 ? vec(0, 1) : vec(dx / d, dy / d);
  // On a straight line (a given segment or a side of the frame): straight out from it, not across it.
  const line = [...task.givenLines, ...frameSides(task.frame)].find((l) => onSegment(l, p));
  if (!line) return away;
  const t = sub(line.b, line.a);
  const len = Math.hypot(t.x, t.y);
  const nrm = vec(-t.y / len, t.x / len);
  return nrm.x * away.x + nrm.y * away.y >= 0 ? nrm : vec(-nrm.x, -nrm.y);
}
