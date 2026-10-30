import { describe, expect, it } from 'vitest';
import { eraseAt } from './erase';
import { addLine, sameSegment } from './segments';
import { type Segment, vec } from './vec';

const seg = (ax: number, ay: number, bx: number, by: number): Segment => ({ a: vec(ax, ay), b: vec(bx, by) });
const has = (pieces: Segment[], s: Segment) => pieces.some((p) => sameSegment(p, s));

describe('eraseAt', () => {
  const grid = [vec(0, 0), vec(12, 0), vec(0, 12), vec(12, 12), vec(0, 4), vec(12, 4)];

  it('removes just the piece between the two nearest points', () => {
    let pieces = addLine([], seg(0, 4, 12, 4), grid);
    pieces = addLine(pieces, seg(0, 12, 12, 0), grid); // crosses at (8,4)
    const after = eraseAt(pieces, vec(3, 4.1), 0.3, grid)!;
    expect(after).toHaveLength(pieces.length - 1);
    expect(has(after, seg(0, 4, 8, 4))).toBe(false);
    expect(has(after, seg(8, 4, 12, 4))).toBe(true);
  });

  it('a tap away from every line erases nothing', () => {
    const pieces = addLine([], seg(0, 4, 12, 4), grid);
    expect(eraseAt(pieces, vec(3, 5), 0.3, grid)).toBeNull();
  });

  it('erases through joints where nothing stops any more', () => {
    let pieces = addLine([], seg(0, 4, 12, 4), grid);
    pieces = addLine(pieces, seg(6, 0, 6, 12), grid); // cuts y=4 at (6,4)
    pieces = eraseAt(pieces, vec(6, 8), 0.3, grid)!; // upper half of the upright line
    pieces = eraseAt(pieces, vec(6, 2), 0.3, grid)!; // lower half: (6,4) is no crossing now
    expect(pieces).toHaveLength(2); // y=4 is still cut at (6,4) …
    expect(eraseAt(pieces, vec(2, 4), 0.3, grid)).toEqual([]); // … but erases as one stretch
  });

  it('stops at a grid point inside a line', () => {
    const points = [...grid, vec(6, 4)];
    const pieces = addLine([], seg(0, 4, 12, 4), points);
    expect(eraseAt(pieces, vec(2, 4), 0.3, points)).toEqual([seg(6, 4, 12, 4)]);
  });

  it('a line ending on another (T) stops the other one there', () => {
    let pieces = addLine([], seg(0, 4, 12, 4), grid);
    pieces = addLine(pieces, seg(6, 4, 6, 12), grid);
    const after = eraseAt(pieces, vec(9, 4), 0.3, grid)!;
    expect(has(after, seg(0, 4, 6, 4))).toBe(true);
    expect(has(after, seg(6, 4, 6, 12))).toBe(true);
  });
});
