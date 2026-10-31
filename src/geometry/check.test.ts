import { describe, expect, it } from 'vitest';
import { tasks } from '../state/tasks';
import { checkDrawing, checkFills, uncovered } from './check';
import { boundaryLines, faces, insidePolygon, interiorPoint, polygonArea } from './faces';
import { addLine, sameSegment } from './segments';
import { type Segment, type Vec, vec } from './vec';

const seg = (ax: number, ay: number, bx: number, by: number): Segment => ({ a: vec(ax, ay), b: vec(bx, by) });
const draw = (lines: Segment[], points = tasks[0].gridPoints) => lines.reduce<Segment[]>((p, l) => addLine(p, l, points), []);
const s0503 = tasks.find((t) => t.id === 's05-03')!;

describe('uncovered', () => {
  it('finds the gaps a cover leaves', () => {
    const gaps = uncovered(seg(0, 4, 12, 4), [seg(0, 4, 3, 4), seg(5, 4, 8, 4), seg(7, 4, 9, 4)]);
    expect(gaps).toHaveLength(2);
    expect(sameSegment(gaps[0], seg(3, 4, 5, 4))).toBe(true);
    expect(sameSegment(gaps[1], seg(9, 4, 12, 4))).toBe(true);
  });

  it('ignores covers on other lines', () => {
    expect(uncovered(seg(0, 4, 12, 4), [seg(0, 4.1, 12, 4.1)])).toHaveLength(1);
  });
});

describe('checkDrawing', () => {
  it.each(tasks.map((t) => [t.id, t] as const))('%s: drawing the target lines is right', (_, t) => {
    const r = checkDrawing(draw(t.targetLines, t.gridPoints), t.targetLines, t.frame);
    expect(r).toEqual({ missing: [], extra: [], done: true });
  });

  it('accepts a line drawn in two parts, backwards, or twice', () => {
    const drawn = draw([seg(12, 4, 6, 4), seg(0, 4, 6, 4), seg(0, 8, 12, 8), seg(12, 0, 0, 12), seg(0, 8, 12, 8)]);
    expect(checkDrawing(drawn, s0503.targetLines, s0503.frame).done).toBe(true);
  });

  it('a line along the frame is no mistake', () => {
    const drawn = draw([...s0503.targetLines, seg(0, 0, 12, 0)]);
    expect(checkDrawing(drawn, s0503.targetLines, s0503.frame).done).toBe(true);
  });

  it('reports what is missing', () => {
    const r = checkDrawing(draw([seg(0, 4, 12, 4), seg(0, 8, 6, 8)]), s0503.targetLines, s0503.frame);
    expect(r.done).toBe(false);
    expect(r.extra).toEqual([]);
    expect(r.missing).toHaveLength(2); // the right half of y=8 and the whole diagonal
  });

  it('reports a wrong line once, although it is cut into pieces', () => {
    const drawn = draw([...s0503.targetLines, seg(0, 0, 12, 12)]);
    const r = checkDrawing(drawn, s0503.targetLines, s0503.frame);
    expect(r.missing).toEqual([]);
    expect(r.extra).toHaveLength(1);
    expect(sameSegment(r.extra[0], seg(0, 0, 12, 12))).toBe(true);
  });
});

describe('checkFills on the task files', () => {
  const withAreas = tasks.filter((t) => t.areas.length);

  it('there are tasks to fill in', () => {
    expect(withAreas.length).toBeGreaterThan(0);
  });

  it.each(withAreas.map((t) => [t.id, t] as const))('%s: target lines plus the filled areas are right', (_, t) => {
    const drawn = draw(t.targetLines, t.gridPoints);
    const all = faces(boundaryLines(t.frame, t.givenLines, drawn, t.gridPoints));
    // The child taps every face that lies in a target area (an area may be cut into several).
    const wanted = all.filter((f) => t.areas.some((a) => insidePolygon(a, interiorPoint(f))));
    expect(checkFills(all, wanted.map(interiorPoint), t.areas)).toEqual({ missing: [], extra: [] });
    // Those faces make up exactly the target areas.
    const sum = (list: Vec[][]) => list.reduce((n, p) => n + Math.abs(polygonArea(p)), 0);
    expect(sum(wanted)).toBeCloseTo(sum(t.areas), 1);
    // Nothing filled: every area is missing.
    expect(checkFills(all, [], t.areas).missing.length).toBeGreaterThan(0);
  });
});
