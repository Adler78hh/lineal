import { describe, expect, it } from 'vitest';
import { edgeStops, strokeToLine } from './draw';
import { frameCrossings, insideFrame } from './frame';
import { parseTask } from './task';
import { type Vec, vec } from './vec';

const square = parseTask({ id: 'q', frame: { type: 'rect', w: 12, h: 12 }, targetLines: [] }).frame;
const circle = parseTask({ id: 'c', frame: { type: 'circle', n: 4 }, targetLines: [] }).frame;
const grid = [vec(0, 0), vec(12, 0), vec(12, 12), vec(0, 12), vec(0, 4), vec(12, 4)];
const sortX = (ps: Vec[]) => [...ps].sort((p, q) => p.x - q.x || p.y - q.y);

describe('frame', () => {
  it('knows inside and border', () => {
    expect(insideFrame(square, vec(6, 6))).toBe(true);
    expect(insideFrame(square, vec(12, 3))).toBe(true);
    expect(insideFrame(square, vec(12.1, 3))).toBe(false);
    expect(insideFrame(circle, vec(6, 0))).toBe(true);
    expect(insideFrame(circle, vec(0.5, 0.5))).toBe(false);
  });

  it('finds where a line crosses the border', () => {
    expect(sortX(frameCrossings({ a: vec(-3, 5), b: vec(15, 5) }, square))).toEqual([vec(0, 5), vec(12, 5)]);
    expect(sortX(frameCrossings({ a: vec(-3, 6), b: vec(15, 6) }, circle))).toEqual([vec(0, 6), vec(12, 6)]);
  });

  it('a line along a side touches it at the corners', () => {
    expect(sortX(frameCrossings({ a: vec(-3, 0), b: vec(15, 0) }, square))).toEqual([vec(0, 0), vec(12, 0)]);
  });
});

describe('drawing along the ruler', () => {
  const flat = (y: number) => ({ origin: vec(6, y), angle: 0 });

  it('stops: grid points on the edge, border crossings, crossings with drawn lines', () => {
    const stops = edgeStops(flat(5), square, grid, [{ a: vec(6, 0), b: vec(6, 12) }]);
    expect(sortX(stops)).toEqual([vec(0, 5), vec(6, 5), vec(12, 5)]);
    expect(sortX(edgeStops(flat(4), square, grid, []))).toEqual([vec(0, 4), vec(12, 4)]);
  });

  it('a lines drawn on top of the edge gives its ends as stops', () => {
    const stops = edgeStops(flat(4), square, grid, [{ a: vec(3, 4), b: vec(9, 4) }]);
    expect(sortX(stops)).toEqual([vec(0, 4), vec(3, 4), vec(9, 4), vec(12, 4)]);
  });

  it('a swipe becomes the line between the nearest stops', () => {
    const stops = [vec(0, 4), vec(6, 4), vec(12, 4)];
    const wobbly = [vec(0.4, 3.7), vec(3, 3.5), vec(8, 3.9), vec(11.5, 3.6)];
    expect(strokeToLine(flat(4), wobbly, stops, 0.2)).toEqual({ a: vec(0, 4), b: vec(12, 4) });
    expect(strokeToLine(flat(4), [vec(1, 3.8), vec(5, 3.8)], stops, 0.2)).toEqual({ a: vec(0, 4), b: vec(6, 4) });
    // Drawn right to left: same line.
    expect(strokeToLine(flat(4), [vec(11, 3.8), vec(7, 3.8)], stops, 0.2)).toEqual({ a: vec(6, 4), b: vec(12, 4) });
  });

  it('too short, or both ends at the same stop: no line', () => {
    const stops = [vec(0, 4), vec(12, 4)];
    expect(strokeToLine(flat(4), [vec(5, 3.8), vec(5.1, 3.8)], stops, 0.2)).toBeNull();
    expect(strokeToLine(flat(4), [vec(1, 3.8), vec(3, 3.8)], stops, 0.2)).toBeNull();
  });
});
