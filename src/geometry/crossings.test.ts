import { describe, expect, it } from 'vitest';
import { crossingPoints } from './crossings';
import { addLine } from './segments';
import { type Segment, vec } from './vec';

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
