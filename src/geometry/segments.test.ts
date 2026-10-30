import { describe, expect, it } from 'vitest';
import { addLine, onSegment, sameSegment, splitAt, splitAtPoints } from './segments';
import { type Segment, vec } from './vec';

const seg = (ax: number, ay: number, bx: number, by: number): Segment => ({ a: vec(ax, ay), b: vec(bx, by) });
const has = (pieces: Segment[], s: Segment) => pieces.some((p) => sameSegment(p, s));

describe('segments', () => {
  it('knows points on a segment', () => {
    expect(onSegment(seg(0, 0, 12, 12), vec(6, 6))).toBe(true);
    expect(onSegment(seg(0, 0, 12, 12), vec(13, 13))).toBe(false);
    expect(onSegment(seg(0, 0, 12, 12), vec(6, 6.01))).toBe(false);
  });

  it('splits in order and ignores points off the segment and at its ends', () => {
    const parts = splitAt(seg(0, 4, 12, 4), [vec(8, 4), vec(4, 4), vec(0, 4), vec(5, 5)]);
    expect(parts).toEqual([seg(0, 4, 4, 4), seg(4, 4, 8, 4), seg(8, 4, 12, 4)]);
  });

  it('cuts a new line at grid points', () => {
    const pieces = addLine([], seg(6, 0, 6, 12), [vec(6, 0), vec(6, 6), vec(6, 12), vec(0, 0)]);
    expect(pieces).toEqual([seg(6, 0, 6, 6), seg(6, 6, 6, 12)]);
  });

  it('cuts both lines where they cross', () => {
    let pieces = addLine([], seg(0, 4, 12, 4), []);
    pieces = addLine(pieces, seg(0, 12, 12, 0), []);
    expect(pieces).toHaveLength(4);
    expect(has(pieces, seg(0, 4, 8, 4))).toBe(true);
    expect(has(pieces, seg(8, 4, 12, 0))).toBe(true);
  });

  it('cuts an existing line where a new one ends on it (T-junction)', () => {
    let pieces = addLine([], seg(0, 6, 12, 6), []);
    pieces = addLine(pieces, seg(6, 6, 6, 12), []);
    expect(pieces).toHaveLength(3);
    expect(has(pieces, seg(0, 6, 6, 6))).toBe(true);
  });

  it('drawing over an existing line adds nothing twice', () => {
    let pieces = addLine([], seg(0, 4, 12, 4), [vec(4, 4)]);
    pieces = addLine(pieces, seg(12, 4, 0, 4), [vec(4, 4)]);
    expect(pieces).toHaveLength(2);
  });

  it('an overlapping line only adds the part that was missing', () => {
    let pieces = addLine([], seg(0, 0, 6, 0), []);
    pieces = addLine(pieces, seg(3, 0, 12, 0), []);
    expect(pieces).toHaveLength(3);
    expect(has(pieces, seg(0, 0, 3, 0))).toBe(true);
    expect(has(pieces, seg(3, 0, 6, 0))).toBe(true);
    expect(has(pieces, seg(6, 0, 12, 0))).toBe(true);
  });

  it('cuts at new grid points later', () => {
    expect(splitAtPoints([seg(0, 0, 12, 12)], [vec(6, 6)])).toHaveLength(2);
  });
});
