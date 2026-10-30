import { describe, expect, it } from 'vitest';
import { TaskError, circlePoints, parseTask } from './task';
import { vec } from './vec';

describe('parseTask', () => {
  const s0503 = {
    id: 's05-03',
    frame: { type: 'rect', w: 12, h: 12 },
    gridPoints: [[0, 0], [12, 0], [12, 12], [0, 12], [0, 4], [12, 4], [0, 8], [12, 8]],
    targetLines: [[[0, 4], [12, 4]], [[0, 8], [12, 8]], [[0, 12], [12, 0]]],
  };

  it('reads a rect task', () => {
    const t = parseTask(s0503);
    expect(t.frame).toEqual({ kind: 'polygon', vertices: [vec(0, 0), vec(12, 0), vec(12, 12), vec(0, 12)] });
    expect(t.gridPoints).toHaveLength(8);
    expect(t.targetLines[2]).toEqual({ a: vec(0, 12), b: vec(12, 0) });
    expect(t.bounds).toEqual({ minX: 0, minY: 0, maxX: 12, maxY: 12 });
    expect(t.title).toBe('s05-03');
  });

  it('drops duplicate grid points', () => {
    const t = parseTask({ ...s0503, gridPoints: [...s0503.gridPoints, [0, 4], [0, 4.0000001]] });
    expect(t.gridPoints).toHaveLength(8);
  });

  it('adds n evenly spread points for a circle frame', () => {
    const t = parseTask({ id: 'c', frame: { type: 'circle', n: 4 }, targetLines: [] });
    expect(t.gridPoints).toEqual([vec(6, 12), vec(0, 6), vec(6, 0), vec(12, 6)]);
    expect(t.bounds).toEqual({ minX: 0, minY: 0, maxX: 12, maxY: 12 });
  });

  it('uses the corners of a polygon frame as grid points', () => {
    const t = parseTask({ id: 'p', frame: { type: 'polygon', n: 6, r: 5 }, targetLines: [] });
    expect(t.frame.kind).toBe('polygon');
    expect(t.gridPoints).toHaveLength(6);
    expect(t.gridPoints[0]).toEqual(vec(6, 11));
  });

  it('rejects broken tasks with a readable message', () => {
    expect(() => parseTask({ id: 'x', frame: { type: 'star' }, targetLines: [] })).toThrow(TaskError);
    expect(() => parseTask({ id: 'x', frame: { type: 'rect', w: 12, h: 12 }, targetLines: [[[0, 0]]] })).toThrow(
      /Aufgabe x: targetLines\[0\]/,
    );
    expect(() => parseTask({ frame: { type: 'rect', w: 1, h: 1 }, targetLines: [] })).toThrow(/id fehlt/);
  });
});

describe('circlePoints', () => {
  it('goes counter-clockwise from the given angle', () => {
    expect(circlePoints(vec(0, 0), 1, 4, 0)).toEqual([vec(1, 0), vec(0, 1), vec(-1, 0), vec(0, -1)]);
  });
});
