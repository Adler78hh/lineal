import { describe, expect, it } from 'vitest';
import { segmentIntersection } from '../geometry/intersect';
import type { Task } from '../geometry/task';
import { type Segment, type Vec, samePoint } from '../geometry/vec';
import { tasks } from './tasks';

/**
 * Points a child can reach with the ruler: the grid points; crossings of lines between two
 * grid points (drawn, then erased); then – step by step – crossings of target, help and given
 * lines that can already be drawn.
 */
function reachablePoints(t: Task): Vec[] {
  // Keyed on a 1e-5 raster, so looking a point up stays fast with thousands of crossings.
  const key = (p: Vec) => `${Math.round(p.x * 1e5)},${Math.round(p.y * 1e5)}`;
  const seen = new Set(t.gridPoints.map(key));
  const points = [...t.gridPoints];
  const has = (p: Vec) => seen.has(key(p));
  const addCrossings = (lines: Segment[]) => {
    let grew = false;
    for (let i = 0; i < lines.length; i++)
      for (let j = i + 1; j < lines.length; j++) {
        const x = segmentIntersection(lines[i], lines[j]);
        if (x && !has(x)) {
          seen.add(key(x));
          points.push(x);
          grew = true;
        }
      }
    return grew;
  };
  const g = t.gridPoints;
  addCrossings(g.flatMap((a, i) => g.slice(i + 1).map((b) => ({ a, b }))));
  const known = [...t.targetLines, ...t.helpLines, ...t.givenLines];
  while (addCrossings(known.filter((l) => has(l.a) && has(l.b))));
  return points;
}

describe('task files', () => {
  it('loads the tasks in order, the ten of page 5 first', () => {
    expect(tasks.slice(0, 10).map((t) => t.id)).toEqual(Array.from({ length: 10 }, (_, i) => `s05-${String(i + 1).padStart(2, '0')}`));
    const ids = tasks.map((t) => t.id);
    expect([...ids].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }))).toEqual(ids);
    expect(ids).toHaveLength(62);
  });

  it('has unique ids', () => {
    expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length);
  });

  // A line can only be drawn exactly if the ruler can snap to both of its ends.
  it.each(tasks.map((t) => [t.id, t] as const))('%s: every target line can be drawn with the ruler', (_, t) => {
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
