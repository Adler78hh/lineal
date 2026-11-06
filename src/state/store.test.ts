import { describe, expect, it } from 'vitest';
import { vec } from '../geometry/vec';
import { chooseColor, colorAt, currentLines, currentMadePoints, currentPaint, drawLine, erase, getState, openTask, paintAt, setState } from './store';
import { tasks } from './tasks';

describe('store', () => {
  // The check result is kept while the drawing is the same object; "nothing yet" must be stable too.
  it('returns the same empty lists while nothing is drawn or filled', () => {
    openTask(3);
    expect(currentLines()).toBe(currentLines());
    expect(currentPaint()).toBe(currentPaint());
    expect(currentMadePoints()).toEqual([]);
  });
});

describe('painting', () => {
  // s05-03: three stripes in a square; the line y=4 cuts off the bottom stripe.
  const idx = tasks.findIndex((t) => t.id === 's05-03');

  it('keeps the shape of a painted area when a line around it is erased', () => {
    openTask(idx);
    setState({ drawings: { ...getState().drawings, 's05-03': [] }, paint: { ...getState().paint, 's05-03': [] } });
    drawLine({ a: vec(0, 4), b: vec(12, 4) });
    chooseColor('#327A86');
    paintAt(vec(6, 1));
    expect(colorAt(currentPaint(), vec(6, 1))).toBe('#327A86');
    expect(colorAt(currentPaint(), vec(6, 8))).toBeNull();
    erase(vec(6, 4), 0.5, true);
    expect(currentLines()).toEqual([]);
    // The colour stays below y=4 only; the face is now the whole square, but nothing spreads.
    expect(colorAt(currentPaint(), vec(6, 1))).toBe('#327A86');
    expect(colorAt(currentPaint(), vec(6, 8))).toBeNull();
  });

  it('another colour paints over, the same colour makes it white again', () => {
    openTask(idx);
    setState({ drawings: { ...getState().drawings, 's05-03': [] }, paint: { ...getState().paint, 's05-03': [] } });
    drawLine({ a: vec(0, 4), b: vec(12, 4) });
    chooseColor('#C9548C');
    paintAt(vec(6, 1));
    chooseColor('#D3EAC2');
    paintAt(vec(6, 1));
    expect(colorAt(currentPaint(), vec(6, 1))).toBe('#D3EAC2');
    expect(currentPaint()).toHaveLength(1);
    paintAt(vec(6, 1));
    expect(colorAt(currentPaint(), vec(6, 1))).toBeNull();
  });
});
