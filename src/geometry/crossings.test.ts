import { describe, expect, it } from 'vitest';
import { tasks } from '../state/tasks';
import { crossingPoints, tapPoints } from './crossings';
import { addLine } from './segments';
import { type Segment, type Vec, samePoint, vec } from './vec';

const seg = (ax: number, ay: number, bx: number, by: number): Segment => ({ a: vec(ax, ay), b: vec(bx, by) });
const draw = (...lines: Segment[]) => lines.reduce<Segment[]>((pieces, l) => addLine(pieces, l, []), []);

describe('crossingPoints', () => {
  it('finds where the two midlines cross', () => {
    expect(crossingPoints(draw(seg(6, 0, 6, 12), seg(0, 6, 12, 6)), [])).toEqual([vec(6, 6)]);
  });

  it('finds slanted crossings and T-junctions', () => {
    const pieces = draw(seg(0, 4, 12, 4), seg(0, 12, 12, 0), seg(6, 4, 6, 12));
    const found = crossingPoints(pieces, []);
    // The upright line also crosses the diagonal at (6,6).
    expect(found).toHaveLength(3);
    expect(found).toContainEqual(vec(8, 4));
    expect(found).toContainEqual(vec(6, 4));
    expect(found).toContainEqual(vec(6, 6));
  });

  it('ignores the joint inside a straight line and known points', () => {
    const pieces = draw(seg(0, 4, 12, 4), seg(0, 12, 12, 0));
    expect(crossingPoints(addLine(pieces, seg(0, 4, 12, 4), [vec(3, 4)]), [])).toEqual([vec(8, 4)]);
    expect(crossingPoints(pieces, [vec(8, 4)])).toEqual([]);
  });
});

describe('tapPoints', () => {
  const t = tasks.find((x) => x.id === 's34-01')!;
  const has = (list: Vec[], p: Vec) => list.some((q) => samePoint(q, p));

  it('offers where a drawn line meets the circle frame (34-1: the missing marks top and bottom)', () => {
    // The line through the two crossings S1, S2 runs to the circle at both ends.
    const line: Segment = { a: vec(6, 0), b: vec(6, 12) };
    const pts = tapPoints([line], t, t.gridPoints);
    expect(has(pts, vec(6, 12))).toBe(true);
    expect(has(pts, vec(6, 0))).toBe(true);
    expect(crossingPoints([line], t.gridPoints)).toEqual([]);
  });

  it('offers where a drawn line crosses a side of the frame or a given line, not the grid points', () => {
    const rect = tasks.find((x) => x.id === 's05-01')!;
    const pts = tapPoints([{ a: vec(-1, 6), b: vec(13, 6) }], rect, rect.gridPoints);
    expect(has(pts, vec(0, 6))).toBe(true);
    expect(has(pts, vec(12, 6))).toBe(true);
    const given = tasks.find((x) => x.givenLines.length)!;
    const g = given.givenLines[0];
    const m = vec((g.a.x + g.b.x) / 2, (g.a.y + g.b.y) / 2);
    const across = { a: vec(m.x - (g.b.y - g.a.y), m.y + (g.b.x - g.a.x)), b: vec(m.x + (g.b.y - g.a.y), m.y - (g.b.x - g.a.x)) };
    expect(has(tapPoints([across], given, []), m)).toBe(true);
    expect(tapPoints([across], given, [m])).not.toContainEqual(m);
  });
});
