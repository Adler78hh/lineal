import { describe, expect, it } from 'vitest';
import { checkFills, filledBySeeds } from './check';
import { boundaryLines, faceAt, faces, interiorPoint, insidePolygon, polygonArea } from './faces';
import { parseTask } from './task';
import { type Segment, vec } from './vec';

const seg = (ax: number, ay: number, bx: number, by: number): Segment => ({ a: vec(ax, ay), b: vec(bx, by) });
const square = parseTask({ id: 'q', frame: { type: 'rect', w: 12, h: 12 }, targetLines: [] }).frame;
const circle = parseTask({ id: 'c', frame: { type: 'circle', n: 4 }, targetLines: [] });

describe('faces', () => {
  it('the frame alone is one face', () => {
    const f = faces(boundaryLines(square, [], [], []));
    expect(f).toHaveLength(1);
    expect(polygonArea(f[0])).toBeCloseTo(144);
  });

  it('a cross cuts the square into four, a diagonal into two more', () => {
    expect(faces(boundaryLines(square, [], [seg(6, 0, 6, 12), seg(0, 6, 12, 6)], []))).toHaveLength(4);
    expect(faces(boundaryLines(square, [], [seg(6, 0, 6, 12), seg(0, 6, 12, 6), seg(0, 0, 12, 12)], []))).toHaveLength(6);
  });

  it('a loose line end does not close an area', () => {
    expect(faces(boundaryLines(square, [], [seg(0, 6, 6, 6)], []))).toHaveLength(1);
  });

  it('finds the face under a point', () => {
    const f = faces(boundaryLines(square, [], [seg(0, 12, 12, 0)], []));
    const lower = faceAt(f, vec(2, 2))!;
    expect(polygonArea(lower)).toBeCloseTo(72);
    expect(insidePolygon(lower, vec(10, 10))).toBe(false);
  });

  it('chords in a circle frame bound areas together with the arc', () => {
    // A square inside the circle through its four points: 1 inner face + 4 caps.
    const pts = circle.gridPoints;
    const sq = pts.map((p, i) => ({ a: p, b: pts[(i + 1) % 4] }));
    const f = faces(boundaryLines(circle.frame, [], sq, pts));
    expect(f).toHaveLength(5);
    expect(polygonArea(faceAt(f, vec(6, 6))!)).toBeCloseTo(72);
  });

  it('interiorPoint lies inside, also for an L shape', () => {
    const l = [vec(0, 0), vec(4, 0), vec(4, 1), vec(1, 1), vec(1, 4), vec(0, 4)];
    expect(insidePolygon(l, interiorPoint(l))).toBe(true);
  });
});

describe('checkFills', () => {
  const f = faces(boundaryLines(square, [], [seg(0, 12, 12, 0)], []));
  const lowerLeft = [vec(0, 0), vec(12, 0), vec(0, 12)];

  it('right when exactly the target area is filled', () => {
    expect(checkFills(f, filledBySeeds(f, [vec(2, 2)]), [lowerLeft])).toEqual({ missing: [], extra: [] });
  });

  it('reports a missing and an extra fill', () => {
    const r = checkFills(f, filledBySeeds(f, [vec(10, 10)]), [lowerLeft]);
    expect(r.missing).toHaveLength(1);
    expect(r.extra).toHaveLength(1);
  });
});
