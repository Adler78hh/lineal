import { describe, expect, it } from 'vitest';
import { segmentIntersection } from './intersect';
import { vec } from './vec';

const seg = (ax: number, ay: number, bx: number, by: number) => ({ a: vec(ax, ay), b: vec(bx, by) });

describe('segmentIntersection', () => {
  it('finds the crossing of the two midlines', () => {
    expect(segmentIntersection(seg(6, 0, 6, 12), seg(0, 6, 12, 6))).toEqual(vec(6, 6));
  });

  it('finds a crossing of slanted lines', () => {
    expect(segmentIntersection(seg(0, 12, 12, 0), seg(0, 4, 12, 4))).toEqual(vec(8, 4));
  });

  it('counts touching ends', () => {
    expect(segmentIntersection(seg(0, 0, 6, 12), seg(6, 12, 12, 0))).toEqual(vec(6, 12));
  });

  it('has none for segments that would only meet when extended', () => {
    expect(segmentIntersection(seg(0, 0, 2, 2), seg(0, 6, 12, 6))).toBeNull();
  });

  it('has none for parallel segments', () => {
    expect(segmentIntersection(seg(0, 3, 12, 3), seg(0, 6, 12, 6))).toBeNull();
    expect(segmentIntersection(seg(0, 3, 6, 3), seg(3, 3, 12, 3))).toBeNull();
  });
});
