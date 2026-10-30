import { eraseAt } from '../geometry/erase';
import { addLine } from '../geometry/segments';
import { type Segment, type Vec, samePoint } from '../geometry/vec';
import { tasks } from './tasks';

/** What a finger on the board does: work with the ruler (move it, draw along it) or erase. */
export type Tool = 'ruler' | 'eraser';

export interface AppState {
  taskIndex: number;
  /** Not remembered: the app always starts with the ruler. */
  tool: Tool;
  showGrid: boolean;
  showRuler: boolean;
  /** Drawn pieces per task id. */
  drawings: Record<string, Segment[]>;
  /** Crossings the child turned into grid points, per task id. */
  madePoints: Record<string, Vec[]>;
}

type Listener = (s: AppState) => void;

const STORAGE_KEY = 'lineal.v1';

function load(): AppState {
  const fallback: AppState = { taskIndex: 0, tool: 'ruler', showGrid: true, showRuler: true, drawings: {}, madePoints: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<AppState> | null;
    if (!saved) return fallback;
    const taskIndex = Number.isInteger(saved.taskIndex) ? Math.min(Math.max(saved.taskIndex!, 0), tasks.length - 1) : 0;
    const record = <T>(v: Record<string, T> | undefined): Record<string, T> => (v && typeof v === 'object' ? v : {});
    return {
      taskIndex,
      tool: 'ruler',
      showGrid: saved.showGrid !== false,
      showRuler: saved.showRuler !== false,
      drawings: record(saved.drawings),
      madePoints: record(saved.madePoints),
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

// ---- changes to the drawing, with undo ----

interface Snapshot {
  lines: Segment[];
  made: Vec[];
}

/** Earlier states of each task's drawing, newest last. Kept only while the app is open. */
const history: Record<string, Snapshot[]> = {};
const MAX_UNDO = 200;

function remember(): void {
  const stack = (history[currentTask().id] ??= []);
  stack.push({ lines: currentLines(), made: currentMadePoints() });
  if (stack.length > MAX_UNDO) stack.shift();
}

function change(lines: Segment[], made: Vec[] = currentMadePoints()): void {
  const id = currentTask().id;
  setState({ drawings: { ...state.drawings, [id]: lines }, madePoints: { ...state.madePoints, [id]: made } });
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
  if (last) change(last.lines, last.made);
}
