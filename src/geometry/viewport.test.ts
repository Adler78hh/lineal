import { describe, expect, it } from 'vitest';
import { vec } from './vec';
import { fitViewport } from './viewport';

describe('fitViewport', () => {
  const b = { minX: 0, minY: 0, maxX: 12, maxY: 12 };

  it('flips y: the origin is bottom left on screen', () => {
    const vp = fitViewport(b, 140, 140, 10);
    expect(vp.scale).toBe(10);
    expect(vp.toScreen(vec(0, 0))).toEqual(vec(10, 130));
    expect(vp.toScreen(vec(12, 12))).toEqual(vec(130, 10));
  });

  it('centres the figure in a wide area', () => {
    const vp = fitViewport(b, 300, 140, 10);
    expect(vp.toScreen(vec(6, 6))).toEqual(vec(150, 70));
  });

  it('round-trips between task and screen coordinates', () => {
    const vp = fitViewport({ minX: -3, minY: 2, maxX: 9, maxY: 7 }, 411, 287, 23);
    const p = vec(4.25, 3.5);
    const q = vp.toWorld(vp.toScreen(p));
    expect(q.x).toBeCloseTo(p.x, 9);
    expect(q.y).toBeCloseTo(p.y, 9);
  });
});
