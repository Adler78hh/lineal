import { type Bounds, type Segment, type Vec, boundsOf, tidy, uniquePoints, vec } from './vec';

type Pair = [number, number];

/** Frame as written in a task file. Circle and polygon default to centre (6,6), radius 6, first point on top. */
export type FrameJson =
  | { type: 'rect'; w: number; h: number }
  | { type: 'circle'; n: number; cx?: number; cy?: number; r?: number; rotation?: number }
  | { type: 'polygon'; n: number; cx?: number; cy?: number; r?: number; rotation?: number };

/** A task file in /tasks. Coordinates 0–12, origin bottom left. */
export interface TaskJson {
  id: string;
  title?: string;
  /** Hint for the teacher, e.g. which intersection has to become a grid point first. */
  note?: string;
  frame: FrameJson;
  gridPoints?: Pair[];
  targetLines: [Pair, Pair][];
}

export type Frame =
  | { kind: 'polygon'; vertices: Vec[] }
  | { kind: 'circle'; center: Vec; r: number; points: Vec[] };

export interface Task {
  id: string;
  title: string;
  note?: string;
  frame: Frame;
  /** Magnetic points: those from the file plus the points the frame brings along. */
  gridPoints: Vec[];
  targetLines: Segment[];
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

/** The frame and the magnetic points it brings along (circle points, polygon corners; a rect brings none). */
function parseFrame(f: unknown): { frame: Frame; points: Vec[] } {
  const o = (f ?? {}) as Record<string, unknown>;
  switch (o.type) {
    case 'rect': {
      const w = num(o.w, 'frame.w');
      const h = num(o.h, 'frame.h');
      return { frame: { kind: 'polygon', vertices: [vec(0, 0), vec(w, 0), vec(w, h), vec(0, h)] }, points: [] };
    }
    case 'circle':
    case 'polygon': {
      const n = num(o.n, 'frame.n');
      if (!Number.isInteger(n) || n < (o.type === 'polygon' ? 3 : 0)) throw new TaskError('frame.n: ungültig');
      const center = vec(o.cx === undefined ? 6 : num(o.cx, 'frame.cx'), o.cy === undefined ? 6 : num(o.cy, 'frame.cy'));
      const r = o.r === undefined ? 6 : num(o.r, 'frame.r');
      const pts = circlePoints(center, r, n, o.rotation === undefined ? 90 : num(o.rotation, 'frame.rotation'));
      const frame: Frame = o.type === 'circle' ? { kind: 'circle', center, r, points: pts } : { kind: 'polygon', vertices: pts };
      return { frame, points: pts };
    }
    default:
      throw new TaskError(`frame.type: unbekannt (${String(o.type)})`);
  }
}

export function parseTask(json: unknown): Task {
  const o = (json ?? {}) as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id) throw new TaskError('id fehlt');
  try {
    const { frame, points: framePoints } = parseFrame(o.frame);
    const filePoints = ((o.gridPoints ?? []) as unknown[]).map((p, i) => point(p, `gridPoints[${i}]`));
    if (!Array.isArray(o.targetLines)) throw new TaskError('targetLines fehlt');
    const targetLines = o.targetLines.map((l: unknown, i: number) => {
      if (!Array.isArray(l) || l.length !== 2) throw new TaskError(`targetLines[${i}]: zwei Punkte erwartet`);
      return { a: point(l[0], `targetLines[${i}]`), b: point(l[1], `targetLines[${i}]`) };
    });
    const outline = frame.kind === 'circle' ? circlePoints(frame.center, frame.r, 4, 0) : frame.vertices;
    return {
      id: o.id,
      title: typeof o.title === 'string' ? o.title : o.id,
      note: typeof o.note === 'string' ? o.note : undefined,
      frame,
      gridPoints: uniquePoints([...framePoints, ...filePoints]),
      targetLines,
      bounds: boundsOf(outline),
    };
  } catch (e) {
    if (e instanceof TaskError) throw new TaskError(`Aufgabe ${o.id}: ${e.message}`);
    throw e;
  }
}
