import { describe, expect, it } from 'vitest';
import { segmentIntersection } from '../geometry/intersect';
import type { Task } from '../geometry/task';
import { type Vec, samePoint } from '../geometry/vec';
import { tasks } from './tasks';

/**
 * Points a child can snap to: the grid points, plus – step by step – the intersections
 * of target lines that can already be drawn (they can be turned into new grid points).
 */
function reachablePoints(t: Task): Vec[] {
  const points = [...t.gridPoints];
  const has = (p: Vec) => points.some((q) => samePoint(p, q));
  for (let grew = true; grew; ) {
    grew = false;
    const drawable = t.targetLines.filter((l) => has(l.a) && has(l.b));
    for (const l of drawable)
      for (const m of drawable) {
        const x = segmentIntersection(l, m);
        if (x && !has(x)) {
          points.push(x);
          grew = true;
        }
      }
  }
  return points;
}

describe('task files', () => {
  it('loads the ten tasks of page 5 in order', () => {
    expect(tasks.map((t) => t.id)).toEqual(Array.from({ length: 10 }, (_, i) => `s05-${String(i + 1).padStart(2, '0')}`));
  });

  it('has unique ids', () => {
    expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length);
  });

  // A line can only be drawn exactly if the ruler can snap to both of its ends.
  it.each(tasks.map((t) => [t.id, t] as const))('%s: every target line can be drawn from grid or intersection points', (_, t) => {
    const reachable = reachablePoints(t);
    for (const l of t.targetLines) {
      for (const end of [l.a, l.b]) expect(reachable.some((p) => samePoint(p, end)), `${end.x},${end.y}`).toBe(true);
    }
  });

  it('s05-10 needs the centre as an intersection point', () => {
    const t = tasks.find((x) => x.id === 's05-10')!;
    expect(t.gridPoints.some((p) => samePoint(p, { x: 6, y: 6 }))).toBe(false);
    expect(reachablePoints(t).some((p) => samePoint(p, { x: 6, y: 6 }))).toBe(true);
  });
});
