import { describe, expect, it } from 'vitest';
import { type RulerPose, edgeCoords, rulerPoint } from '../geometry/ruler';
import { type Vec, vec } from '../geometry/vec';
import { RulerModel } from './rulerModel';

// 50 px per unit: snap 0.24, tear loose 0.96, tap 0.52 units.
const PX = 50;
const grid = [vec(0, 0), vec(12, 0), vec(12, 12), vec(0, 12), vec(0, 4), vec(12, 4)];

/** Edge through `p` at `angle`, `p` lying `k` units left of the middle of the edge. */
const through = (p: Vec, angle: number, k = 6): RulerPose => ({
  origin: vec(p.x + k * Math.cos(angle), p.y + k * Math.sin(angle)),
  angle,
});

function model(pose: RulerPose) {
  const m = new RulerModel(pose, grid);
  m.setScale(PX);
  return m;
}

/** One finger drags from `a` to `b` in small steps. */
function drag(m: RulerModel, a: Vec, b: Vec, grip: 'body' | 'handle' = 'body', lift = true) {
  m.begin(grip, 1, a);
  for (let i = 1; i <= 10; i++) m.move(1, vec(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10));
  if (lift) m.lift(1);
}

const onEdge = (m: RulerModel, p: Vec) => Math.abs(edgeCoords(m.view.pose, p).d) < 1e-9;

describe('RulerModel', () => {
  it('a free ruler moves and snaps onto two points: then it is fixed', () => {
    const m = model({ origin: vec(6, 5), angle: 0.01 });
    expect(m.view.mode).toBe('free');
    drag(m, vec(6, 5.5), vec(6, 4.6));
    expect(m.view.anchors).toEqual([vec(0, 4), vec(12, 4)]);
    expect(m.view.mode).toBe('fixed');
  });

  it('with one anchor, dragging turns the ruler around it', () => {
    const m = model(through(vec(0, 0), 0.3));
    expect(m.view.anchors).toEqual([vec(0, 0)]);
    expect(m.view.mode).toBe('pivot');
    const grab = rulerPoint(m.view.pose, 0, 0.5);
    drag(m, grab, vec(grab.x - 1, grab.y + 1));
    expect(onEdge(m, vec(0, 0))).toBe(true);
    expect(m.view.pose.angle).toBeGreaterThan(0.4);
    expect(m.view.mode).toBe('pivot');
  });

  it('turning around the pivot clicks into a second point', () => {
    // The ruler (18 long) must reach from (0,0) to (12,12), so (0,0) sits near its end.
    const m = model(through(vec(0, 0), Math.PI / 4 - 0.3, 8.6));
    const grab = rulerPoint(m.view.pose, 3, 0.5);
    // Push the far end up until the edge nearly hits (12,12).
    drag(m, grab, vec(grab.x - 2.5, grab.y + 2.2));
    expect(m.view.anchors).toEqual([vec(0, 0), vec(12, 12)]);
    expect(m.view.pose.angle).toBeCloseTo(Math.PI / 4, 9);
    expect(m.view.mode).toBe('fixed');
  });

  it('turning around a point near the middle of the ruler still reaches the far corner', () => {
    // (0,12) is only 3 units from the middle of the edge: the ruler itself ends before (12,0).
    const m = model(through(vec(0, 12), -Math.PI / 4 + 0.25, 3));
    const grab = rulerPoint(m.view.pose, 2, 0.5);
    const turn = -0.24;
    const g = vec(grab.x, grab.y - 12);
    drag(m, grab, vec(g.x * Math.cos(turn) - g.y * Math.sin(turn), 12 + g.x * Math.sin(turn) + g.y * Math.cos(turn)));
    expect(m.view.anchors).toEqual([vec(12, 0), vec(0, 12)]);
    expect(m.view.mode).toBe('fixed');
  });

  it('a fixed ruler stays put on a small pull and tears loose on a clear one', () => {
    const m = model({ origin: vec(6, 4), angle: 0 });
    expect(m.view.mode).toBe('fixed');
    drag(m, vec(6, 5), vec(6.3, 5.5));
    expect(m.view.pose).toEqual({ origin: vec(6, 4), angle: 0 });
    drag(m, vec(6, 5), vec(6, 6.5));
    expect(m.view.mode).toBe('free');
    expect(m.view.pose.origin.y).toBeCloseTo(5.5);
  });

  it('pulling a fixed ruler along its edge tears it loose and it does not snap back onto the same points', () => {
    const m = model({ origin: vec(6, 4), angle: 0 });
    drag(m, vec(6, 5), vec(7.5, 5));
    expect(m.view.mode).toBe('free');
    expect(m.view.anchors).toEqual([]);
    expect(m.view.pose.origin.x).toBeCloseTo(7.5);
  });

  it('pulling away from the pivot tears it loose', () => {
    const m = model(through(vec(0, 0), 0.3));
    const grab = rulerPoint(m.view.pose, 0, 0.5);
    const away = vec(grab.x + 1.2 * Math.cos(0.3), grab.y + 1.2 * Math.sin(0.3));
    drag(m, grab, away);
    expect(m.view.mode).toBe('free');
    expect(m.view.anchors).toEqual([]);
  });

  it('tapping one of two orange points leaves the other as pivot', () => {
    const m = model({ origin: vec(6, 4), angle: 0 });
    expect(m.pointAt(vec(0.2, 4.1))).toEqual(vec(0, 4));
    m.tap(vec(0, 4));
    expect(m.view.anchors).toEqual([vec(12, 4)]);
    expect(m.view.mode).toBe('pivot');
  });

  it('a point let go by tapping only becomes magnetic again after the edge has left it', () => {
    const m = model(through(vec(0, 0), 0.3));
    m.tap(vec(0, 0));
    expect(m.view.mode).toBe('free');
    drag(m, vec(3, 2), vec(3.05, 2));
    expect(m.view.anchors).toEqual([]);
    drag(m, vec(3, 2), vec(3, 3)); // clearly away …
    drag(m, vec(3, 3), vec(3, 2)); // … and back
    expect(m.view.anchors).toEqual([vec(0, 0)]);
  });

  it('a pinned point stays the pivot however hard one pulls, until it is tapped', () => {
    const m = model(through(vec(0, 0), 0.3));
    m.pin(vec(0, 0));
    const grab = rulerPoint(m.view.pose, 0, 0.5);
    drag(m, grab, vec(grab.x + 3, grab.y + 3));
    expect(m.view.pinned).toEqual(vec(0, 0));
    expect(onEdge(m, vec(0, 0))).toBe(true);
    expect(m.view.mode).toBe('pivot');
    m.tap(vec(0, 0));
    expect(m.view.pinned).toBeNull();
    expect(m.view.mode).toBe('free');
  });

  it('tearing a fixed ruler loose keeps the pin and lets go of the other point', () => {
    const m = model({ origin: vec(6, 4), angle: 0 });
    m.pin(vec(0, 4));
    drag(m, vec(6, 5), vec(6, 7), 'body', false);
    // Still held: now turning around the pin.
    expect(m.view.anchors).toEqual([vec(0, 4)]);
    expect(onEdge(m, vec(0, 4))).toBe(true);
    expect(m.view.pose.angle).toBeGreaterThan(0.1);
    m.lift(1);
    expect(m.view.mode).toBe('pivot');
  });

  it('two fingers turn around the pivot', () => {
    const m = model(through(vec(0, 0), 0.3));
    m.begin('body', 1, vec(4, 2));
    m.addFinger(2, vec(6, 2));
    m.move(2, vec(6, 2.5));
    m.lift(1);
    m.lift(2);
    expect(onEdge(m, vec(0, 0))).toBe(true);
    expect(m.view.pose.angle).toBeGreaterThan(0.45);
  });

  it('the mouse wheel turns around the pivot and does nothing to a fixed ruler', () => {
    const m = model(through(vec(0, 0), 0.3));
    m.turn(vec(5, 5), 0.1);
    expect(onEdge(m, vec(0, 0))).toBe(true);
    expect(m.view.pose.angle).toBeCloseTo(0.4);
    const f = model({ origin: vec(6, 4), angle: 0 });
    f.turn(vec(5, 5), 0.1);
    expect(f.view.pose.angle).toBe(0);
  });
});
