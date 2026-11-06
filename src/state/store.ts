import { eraseAt } from '../geometry/erase';
import { boundaryLines, faceAt, faces, insidePolygon, interiorPoint, polygonArea } from '../geometry/faces';
import { addLine } from '../geometry/segments';
import { type Segment, type Vec, samePoint } from '../geometry/vec';
import { tasks } from './tasks';

/** What a finger on the board does: work with the ruler (move it, draw along it) or erase. */
export type Tool = 'ruler' | 'eraser' | 'fill';

/** A painted area. `color: null` paints it white again (over an older colour). */
export interface Paint {
  poly: Vec[];
  color: string | null;
}

export const BLACK = '#22262B';

export interface AppState {
  /** The start page with all tasks, or one task. */
  screen: 'home' | 'task';
  taskIndex: number;
  /** Not remembered: the app always starts with the ruler. */
  tool: Tool;
  showGrid: boolean;
  showRuler: boolean;
  /** Thin lines in template and drawing, to see the details of busy figures. */
  thinLines: boolean;
  /** The template as large as the board (half and half) instead of small in the corner. */
  bigTemplate: boolean;
  /** Drawn pieces per task id. */
  drawings: Record<string, Segment[]>;
  /** Crossings the child turned into grid points, per task id. */
  madePoints: Record<string, Vec[]>;
  /** Old format (until Nov 2026): filled areas as the points tapped, all black. Read once, then `paint`. */
  fills: Record<string, Vec[]>;
  /** Painted areas per task id, oldest first: each the shape it had when painted, with its colour. */
  paint: Record<string, Paint[]>;
  /** The colour the fill tool paints with. */
  color: string;
  /** Colours the child mixed with the colour wheel, newest first (at most three). */
  customColors: string[];
  /** Tasks the check found right at least once (they get a star on the start page). */
  solved: Record<string, boolean>;
}

type Listener = (s: AppState) => void;

const STORAGE_KEY = 'lineal.v1';

function load(): AppState {
  const fallback: AppState = {
    screen: 'home',
    taskIndex: 0,
    tool: 'ruler',
    showGrid: true,
    showRuler: true,
    thinLines: false,
    bigTemplate: false,
    drawings: {},
    madePoints: {},
    fills: {},
    paint: {},
    color: BLACK,
    customColors: [],
    solved: {},
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<AppState> | null;
    if (!saved) return fallback;
    const taskIndex = Number.isInteger(saved.taskIndex) ? Math.min(Math.max(saved.taskIndex!, 0), tasks.length - 1) : 0;
    const record = <T>(v: Record<string, T> | undefined): Record<string, T> => (v && typeof v === 'object' ? v : {});
    return {
      screen: saved.screen === 'task' ? 'task' : 'home',
      taskIndex,
      tool: 'ruler',
      showGrid: saved.showGrid !== false,
      showRuler: saved.showRuler !== false,
      thinLines: saved.thinLines === true,
      bigTemplate: saved.bigTemplate === true,
      drawings: record(saved.drawings),
      madePoints: record(saved.madePoints),
      fills: record(saved.fills),
      paint: record(saved.paint),
      color: typeof saved.color === 'string' ? saved.color : BLACK,
      customColors: Array.isArray(saved.customColors) ? saved.customColors.filter((c) => typeof c === 'string').slice(0, 3) : [],
      solved: record(saved.solved),
    };
  } catch {
    return fallback;
  }
}

let state = load();
const listeners = new Set<Listener>();

export const getState = (): AppState => state;

export function setState(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or blocked storage: the app still works, it just forgets.
  }
  listeners.forEach((l) => l(state));
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const currentTask = () => tasks[state.taskIndex];

/** Shared empty drawing, so "nothing drawn" stays the same object between renders. */
const NO_LINES: Segment[] = [];

export const currentLines = (): Segment[] => state.drawings[currentTask().id] ?? NO_LINES;

export const currentMadePoints = (): Vec[] => state.madePoints[currentTask().id] ?? [];

/** All magnetic points of the current task: from the task file and made from crossings. */
export const currentPoints = (): Vec[] => [...currentTask().gridPoints, ...currentMadePoints()];

const NO_PAINT: Paint[] = [];

let facesCache: { lines: Segment[]; taskId: string; faces: Vec[][] } | null = null;

/** The closed areas of the current drawing (with frame and given lines). */
export function currentFaces(): Vec[][] {
  const task = currentTask();
  const lines = currentLines();
  if (facesCache?.lines !== lines || facesCache.taskId !== task.id) {
    const bounding = boundaryLines(task.frame, task.givenLines, lines, currentPoints());
    facesCache = { lines, taskId: task.id, faces: faces(bounding) };
  }
  return facesCache.faces;
}

/** Old fills (points, black) turned into painted areas once, kept until the next change saves them. */
const migrated: Record<string, Paint[]> = {};

/** The painted areas of the current task. Same object while nothing changes. */
export function currentPaint(): Paint[] {
  const id = currentTask().id;
  const own = state.paint[id];
  if (own) return own;
  const old = state.fills[id];
  if (!old?.length) return NO_PAINT;
  if (!migrated[id]) {
    const all = currentFaces();
    const polys: Vec[][] = [];
    for (const p of old) {
      const f = faceAt(all, p);
      if (f && !polys.includes(f)) polys.push(f);
    }
    migrated[id] = polys.map((poly) => ({ poly, color: BLACK }));
  }
  return migrated[id];
}

/** The colour at `p`: the newest painted area there (null if painted white or not painted). */
export function colorAt(paint: readonly Paint[], p: Vec): string | null {
  for (let i = paint.length - 1; i >= 0; i--) if (insidePolygon(paint[i].poly, p)) return paint[i].color;
  return null;
}

// ---- changes to the drawing, with undo ----

interface Snapshot {
  lines: Segment[];
  made: Vec[];
  paint: Paint[];
}

/** Earlier states of each task's drawing, newest last. Kept only while the app is open. */
const history: Record<string, Snapshot[]> = {};
const MAX_UNDO = 200;

function remember(): void {
  const stack = (history[currentTask().id] ??= []);
  stack.push({ lines: currentLines(), made: currentMadePoints(), paint: currentPaint() });
  if (stack.length > MAX_UNDO) stack.shift();
}

function change(lines: Segment[], made: Vec[] = currentMadePoints(), paint: Paint[] = currentPaint()): void {
  const id = currentTask().id;
  const { [id]: _old, ...fills } = state.fills;
  setState({
    drawings: { ...state.drawings, [id]: lines },
    madePoints: { ...state.madePoints, [id]: made },
    paint: { ...state.paint, [id]: paint },
    fills,
  });
}

/**
 * Paints the area under `p` with the chosen colour – or white again if it has that colour
 * already. The area keeps its shape even if a line around it is erased later.
 */
export function paintAt(p: Vec): void {
  const face = faceAt(currentFaces(), p);
  if (!face) return;
  const inside = interiorPoint(face);
  const list = currentPaint();
  const next = colorAt(list, inside) === state.color ? null : state.color;
  // Areas painted on exactly this face before are replaced, so the list does not grow.
  const area = Math.abs(polygonArea(face));
  const kept = list.filter((q) => !(Math.abs(Math.abs(polygonArea(q.poly)) - area) < 1e-6 && insidePolygon(face, interiorPoint(q.poly))));
  const after = next === null && colorAt(kept, inside) === null ? kept : [...kept, { poly: face, color: next }];
  remember();
  change(currentLines(), currentMadePoints(), after);
}

/** Chooses the colour to paint with; a colour from the wheel is remembered among the own ones. */
export function chooseColor(color: string, own = false): void {
  const customColors = own ? [color, ...state.customColors.filter((c) => c !== color)].slice(0, 3) : state.customColors;
  setState({ color, customColors, tool: 'fill' });
}

/** Adds a drawn line to the current task, cut into pieces at grid points and crossings. */
export function drawLine(line: Segment): void {
  remember();
  change(addLine(currentLines(), line, currentPoints()));
}

/** Turns a crossing into a magnetic grid point. */
export function makePoint(p: Vec): void {
  if (currentPoints().some((q) => samePoint(p, q))) return;
  remember();
  change(currentLines(), [...currentMadePoints(), p]);
}

/**
 * Erases the stretch of line nearest to `p` (within `tol`), if any. All erasing during one
 * wipe is a single undo step: pass `newStep` only for the first change of the wipe.
 * Returns whether something was erased.
 */
export function erase(p: Vec, tol: number, newStep: boolean): boolean {
  const after = eraseAt(currentLines(), p, tol, currentPoints());
  if (!after) return false;
  if (newStep) remember();
  change(after);
  return true;
}

export const canUndo = (): boolean => (history[currentTask().id]?.length ?? 0) > 0;

export function undo(): void {
  const last = history[currentTask().id]?.pop();
  if (last) change(last.lines, last.made, last.paint);
}

export const openTask = (index: number): void => setState({ screen: 'task', taskIndex: index, tool: 'ruler' });

export const openHome = (): void => setState({ screen: 'home' });

export function markSolved(id: string): void {
  if (!state.solved[id]) setState({ solved: { ...state.solved, [id]: true } });
}
