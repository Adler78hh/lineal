import { describe, expect, it } from 'vitest';
import { RULER, edgeCoords, nearEdge, normAngle, rotateRuler, rulerCorners, snapAroundPivot, snapRuler } from './ruler';
import { applyMotion, turnMotion, twoFingerMotion } from './gesture';
import { type Vec, samePoint, vec } from './vec';

const close = (a: Vec, b: Vec) => expect(samePoint(a, b, 1e-9), `${a.x},${a.y} ≠ ${b.x},${b.y}`).toBe(true);
const flat = (x: number, y: number) => ({ origin: vec(x, y), angle: 0 });

describe('ruler geometry', () => {
  it('has the body above the edge at angle 0', () => {
    const c = rulerCorners(flat(6, 4));
    close(c[0], vec(6 - RULER.length / 2, 4));
    close(c[2], vec(6 + RULER.length / 2, 4 + RULER.width));
  });

  it('measures along and across the edge', () => {
    const r = { origin: vec(0, 0), angle: Math.PI / 2 };
    const { t, d } = edgeCoords(r, vec(-1, 3));
    expect(t).toBeCloseTo(3);
    expect(d).toBeCloseTo(1);
  });

  it('counts points near the line of the edge, also beyond the ends of the ruler', () => {
    expect(nearEdge(flat(6, 4), vec(6, 4.1), 0.2)).toBe(true);
    expect(nearEdge(flat(6, 4), vec(6, 4.3), 0.2)).toBe(false);
    expect(nearEdge(flat(6, 4), vec(6 + RULER.length / 2 + 2, 4), 0.2)).toBe(true);
  });

  it('turns around a point', () => {
    const r = rotateRuler(flat(6, 0), vec(0, 0), Math.PI / 2);
    close(r.origin, vec(0, 6));
    expect(r.angle).toBeCloseTo(Math.PI / 2);
  });

  it('keeps angles in (-π, π]', () => {
    expect(normAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(normAngle(-Math.PI)).toBeCloseTo(Math.PI);
    expect(normAngle(-Math.PI / 2 - 2 * Math.PI)).toBeCloseTo(-Math.PI / 2);
  });
});

describe('snapRuler', () => {
  const grid = [vec(0, 0), vec(12, 0), vec(12, 12), vec(0, 12), vec(0, 4), vec(12, 4), vec(0, 8), vec(12, 8)];

  it('leaves the ruler alone when no point is close', () => {
    const s = snapRuler(flat(6, 6), grid, 0.2);
    expect(s.points).toEqual([]);
    expect(s.pose).toEqual(flat(6, 6));
  });

  it('shifts the edge exactly through a single close point', () => {
    const free = { origin: vec(6, 5), angle: 0.6 };
    // (0,0) is not on a line through (12,4) at this angle, so only one point snaps.
    const p = vec(12, 4);
    const { d } = edgeCoords(free, p);
    const s = snapRuler({ origin: vec(free.origin.x, free.origin.y + d / Math.cos(0.6) - 0.1), angle: 0.6 }, [p, vec(0, 0)], 0.2);
    expect(s.points).toEqual([p]);
    expect(s.pose.angle).toBeCloseTo(0.6);
    expect(Math.abs(edgeCoords(s.pose, p).d)).toBeLessThan(1e-9);
  });

  it('turns the edge through two close points', () => {
    const s = snapRuler({ origin: vec(6, 4.1), angle: 0.01 }, grid, 0.2);
    expect(s.points).toEqual([vec(0, 4), vec(12, 4)]);
    expect(s.pose.angle).toBeCloseTo(0, 12);
    expect(s.pose.origin.y).toBeCloseTo(4, 12);
  });

  it('snaps onto a diagonal, whichever way round the ruler lies', () => {
    for (const angle of [-Math.PI / 4 + 0.01, (3 * Math.PI) / 4 - 0.01]) {
      const s = snapRuler({ origin: vec(6.05, 6), angle }, grid, 0.2);
      expect(s.points).toEqual([vec(12, 0), vec(0, 12)]);
      expect(Math.abs(normAngle(s.pose.angle - angle))).toBeLessThan(0.05);
    }
  });

  it('marks every point on the edge, also a third one in line', () => {
    const s = snapRuler(flat(6, 0.05), [vec(0, 0), vec(6, 0), vec(12, 0)], 0.2);
    expect(s.points).toHaveLength(3);
  });

  it('does not turn onto a second point that is too far off', () => {
    // Edge through (0, 4.05), slightly rising: (0,4) is close, (12,4) is more than a unit off.
    const origin = vec(5 * Math.cos(0.1), 4.05 + 5 * Math.sin(0.1));
    const s = snapRuler({ origin, angle: 0.1 }, grid, 0.2);
    expect(s.points).toEqual([vec(0, 4)]);
    expect(s.pose.angle).toBeCloseTo(0.1);
  });
});

describe('gestures', () => {
  it('two fingers turning a quarter around their middle', () => {
    const m = twoFingerMotion(vec(-1, 0), vec(1, 0), vec(0, -1), vec(0, 1));
    expect(m.rotation).toBeCloseTo(Math.PI / 2);
    close(m.translation, vec(0, 0));
    const r = applyMotion(flat(2, 0), m);
    close(r.origin, vec(0, 2));
  });

  it('two fingers sliding together just shift', () => {
    const m = twoFingerMotion(vec(0, 0), vec(2, 0), vec(1, 1), vec(3, 1));
    expect(m.rotation).toBeCloseTo(0);
    close(applyMotion(flat(5, 5), m).origin, vec(6, 6));
  });

  it('turning by a handle keeps the pivot in place', () => {
    const r = applyMotion(flat(6, 6), turnMotion(vec(6, 6), vec(10, 6), vec(6, 10)));
    close(r.origin, vec(6, 6));
    expect(r.angle).toBeCloseTo(Math.PI / 2);
  });
});

describe('snapAroundPivot', () => {
  const grid = [vec(0, 0), vec(12, 0), vec(12, 12), vec(0, 12)];

  it('turns onto a second point but keeps the pivot on the edge', () => {
    // Edge through (0,0), nearly along the diagonal.
    const angle = Math.PI / 4 - 0.01;
    const r = { origin: vec(8.5 * Math.cos(angle), 8.5 * Math.sin(angle)), angle };
    const s = snapAroundPivot(r, vec(0, 0), grid, 0.3);
    expect(s.points).toEqual([vec(0, 0), vec(12, 12)]);
    expect(s.pose.angle).toBeCloseTo(Math.PI / 4, 12);
  });

  it('does not shift onto a point that only a shift could reach', () => {
    const r = flat(6, 0);
    const s = snapAroundPivot(r, vec(0, 0), [vec(0, 0), vec(6, 0.1)], 0.3);
    expect(s.points).toEqual([vec(0, 0), vec(6, 0.1)]);
    expect(Math.abs(edgeCoords(s.pose, vec(0, 0)).d)).toBeLessThan(1e-9);
  });
});
