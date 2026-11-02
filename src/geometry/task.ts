import { type Bounds, type Segment, type Vec, boundsOf, tidy, uniquePoints, vec } from './vec';

type Pair = [number, number];
type LineJson = [Pair, Pair];

/**
 * Frame as written in a task file.
 * - rect: the border of 0…w × 0…h.
 * - circle / polygon: default centre (6,6), radius 6, first point on top; `n` points come along.
 *   A circle with `visible: false` is not drawn (only its points, e.g. as marks).
 * - open: no border at all; w × h is just the area shown.
 */
export type FrameJson =
  | { type: 'rect'; w: number; h: number }
  | { type: 'circle'; n?: number; cx?: number; cy?: number; r?: number; rotation?: number; visible?: boolean }
  | { type: 'polygon'; n: number; cx?: number; cy?: number; r?: number; rotation?: number }
  | { type: 'open'; w: number; h: number };

/** A task file in /tasks. Coordinates 0–12, origin bottom left. */
export interface TaskJson {
  id: string;
  title?: string;
  /** Hint for the teacher, e.g. which intersection has to become a grid point first. */
  note?: string;
  frame: FrameJson;
  gridPoints?: Pair[];
  /** How the grid points are shown: dots (default), or marks across the frame / given lines. */
  gridStyle?: 'dots' | 'ticks';
  /** Lines that are already there, like the frame (e.g. a segment with marks to draw to). */
  givenLines?: LineJson[];
  /** Circles that are already there as part of the picture (not a frame: lines may go beyond them). */
  givenCircles?: { cx: number; cy: number; r: number }[];
  targetLines: LineJson[];
  /** Lines the book suggests drawing on the way and erasing again. */
  helpLines?: LineJson[];
  /** Areas to fill in (black), as polygons. */
  areas?: Pair[][];
}

export type Frame =
  | { kind: 'polygon'; vertices: Vec[] }
  | { kind: 'circle'; center: Vec; r: number; points: Vec[]; visible: boolean }
  | { kind: 'open' };

export interface Task {
  id: string;
  title: string;
  note?: string;
  frame: Frame;
  /** Magnetic points: those from the file plus the points the frame brings along. */
  gridPoints: Vec[];
  gridStyle: 'dots' | 'ticks';
  givenLines: Segment[];
  givenCircles: { center: Vec; r: number }[];
  targetLines: Segment[];
  helpLines: Segment[];
  areas: Vec[][];
  bounds: Bounds;
}

export class TaskError extends Error {}

/** n points evenly spread on a circle, counter-clockwise, the first at `rotation` degrees (90 = top). */
export function circlePoints(center: Vec, r: number, n: number, rotation = 90): Vec[] {
  return Array.from({ length: n }, (_, k) => {
    const t = ((rotation + (360 * k) / n) * Math.PI) / 180;
    return vec(tidy(center.x + r * Math.cos(t)), tidy(center.y + r * Math.sin(t)));
  });
}

function num(v: unknown, what: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TaskError(`${what}: Zahl erwartet`);
  return v;
}

function point(v: unknown, what: string): Vec {
  if (!Array.isArray(v) || v.length !== 2) throw new TaskError(`${what}: [x, y] erwartet`);
  return vec(num(v[0], what), num(v[1], what));
}

function lines(v: unknown, what: string): Segment[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new TaskError(`${what}: Liste erwartet`);
  return v.map((l: unknown, i: number) => {
    if (!Array.isArray(l) || l.length !== 2) throw new TaskError(`${what}[${i}]: zwei Punkte erwartet`);
    return { a: point(l[0], `${what}[${i}]`), b: point(l[1], `${what}[${i}]`) };
  });
}

/** The frame, the magnetic points it brings along (circle points, polygon corners; a rect brings none) and the area it takes. */
function parseFrame(f: unknown): { frame: Frame; points: Vec[]; outline: Vec[] } {
  const o = (f ?? {}) as Record<string, unknown>;
  switch (o.type) {
    case 'rect':
    case 'open': {
      const w = num(o.w, 'frame.w');
      const h = num(o.h, 'frame.h');
      const corners = [vec(0, 0), vec(w, 0), vec(w, h), vec(0, h)];
      const frame: Frame = o.type === 'rect' ? { kind: 'polygon', vertices: corners } : { kind: 'open' };
      return { frame, points: [], outline: corners };
    }
    case 'circle':
    case 'polygon': {
      const n = o.n === undefined && o.type === 'circle' ? 0 : num(o.n, 'frame.n');
      if (!Number.isInteger(n) || n < (o.type === 'polygon' ? 3 : 0)) throw new TaskError('frame.n: ungültig');
      const center = vec(o.cx === undefined ? 6 : num(o.cx, 'frame.cx'), o.cy === undefined ? 6 : num(o.cy, 'frame.cy'));
      const r = o.r === undefined ? 6 : num(o.r, 'frame.r');
      const pts = circlePoints(center, r, n, o.rotation === undefined ? 90 : num(o.rotation, 'frame.rotation'));
      if (o.type === 'polygon') return { frame: { kind: 'polygon', vertices: pts }, points: pts, outline: pts };
      const frame: Frame = { kind: 'circle', center, r, points: pts, visible: o.visible !== false };
      return { frame, points: pts, outline: circlePoints(center, r, 4, 0) };
    }
    default:
      throw new TaskError(`frame.type: unbekannt (${String(o.type)})`);
  }
}

export function parseTask(json: unknown): Task {
  const o = (json ?? {}) as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id) throw new TaskError('id fehlt');
  try {
    const { frame, points: framePoints, outline } = parseFrame(o.frame);
    const filePoints = ((o.gridPoints ?? []) as unknown[]).map((p, i) => point(p, `gridPoints[${i}]`));
    if (!Array.isArray(o.targetLines)) throw new TaskError('targetLines fehlt');
    const areas = ((o.areas ?? []) as unknown[]).map((a, i) => {
      if (!Array.isArray(a) || a.length < 3) throw new TaskError(`areas[${i}]: mindestens drei Punkte erwartet`);
      return a.map((p, j) => point(p, `areas[${i}][${j}]`));
    });
    if (o.gridStyle !== undefined && o.gridStyle !== 'dots' && o.gridStyle !== 'ticks') throw new TaskError('gridStyle: dots oder ticks');
    return {
      id: o.id,
      title: typeof o.title === 'string' ? o.title : o.id,
      note: typeof o.note === 'string' ? o.note : undefined,
      frame,
      gridPoints: uniquePoints([...framePoints, ...filePoints]),
      gridStyle: o.gridStyle === 'ticks' ? 'ticks' : 'dots',
      givenLines: lines(o.givenLines, 'givenLines'),
      givenCircles: ((o.givenCircles ?? []) as Record<string, unknown>[]).map((c, i) => ({
        center: vec(num(c.cx, `givenCircles[${i}].cx`), num(c.cy, `givenCircles[${i}].cy`)),
        r: num(c.r, `givenCircles[${i}].r`),
      })),
      targetLines: lines(o.targetLines, 'targetLines'),
      helpLines: lines(o.helpLines, 'helpLines'),
      areas,
      bounds: boundsOf(outline),
    };
  } catch (e) {
    if (e instanceof TaskError) throw new TaskError(`Aufgabe ${o.id}: ${e.message}`);
    throw e;
  }
}
