import { faceAt, insidePolygon, interiorPoint } from './faces';
import { frameSides } from './frame';
import { paramOn } from './segments';
import type { Frame } from './task';
import { type Segment, type Vec, cross, dist, len, sub } from './vec';

/** Rounding tolerance when comparing drawn and target lines (task units). */
export const CHECK_TOL = 1e-3;

export interface CheckResult {
  /** Parts of target lines that nobody drew yet. */
  missing: Segment[];
  /** Drawn parts that are not in the target figure (lines along the frame do not count). */
  extra: Segment[];
  /** Drawn parts that are right. */
  correct: Segment[];
  /** Target lines to draw (not those along the frame or a given line, which are there already). */
  total: number;
  /** Of these, the ones drawn completely. */
  right: number;
  done: boolean;
}

const distToLine = (s: Segment, p: Vec) => Math.abs(cross(sub(s.b, s.a), sub(p, s.a))) / len(sub(s.b, s.a));

/** The parts of `line` that none of `cover` lies on. */
export function uncovered(line: Segment, cover: readonly Segment[], tol = CHECK_TOL): Segment[] {
  const l = len(sub(line.b, line.a));
  const spans = cover
    .filter((c) => distToLine(line, c.a) <= tol && distToLine(line, c.b) <= tol)
    .map((c) => {
      const u = paramOn(line, c.a);
      const v = paramOn(line, c.b);
      return [Math.max(Math.min(u, v), 0), Math.min(Math.max(u, v), 1)] as const;
    })
    .filter(([u, v]) => v > u)
    .sort((x, y) => x[0] - y[0]);
  const at = (u: number): Vec => ({ x: line.a.x + u * (line.b.x - line.a.x), y: line.a.y + u * (line.b.y - line.a.y) });
  const gaps: Segment[] = [];
  let reached = 0;
  for (const [u, v] of spans) {
    if ((u - reached) * l > tol) gaps.push({ a: at(reached), b: at(u) });
    reached = Math.max(reached, v);
  }
  if ((1 - reached) * l > tol) gaps.push({ a: at(reached), b: at(1) });
  return gaps;
}

/** Joins straight pieces that continue each other, so one wrong line counts once. */
export function joinStraight(pieces: readonly Segment[], tol = CHECK_TOL): Segment[] {
  const out = pieces.map((s) => ({ ...s }));
  for (let merged = true; merged; ) {
    merged = false;
    outer: for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++) {
        const s = out[i];
        const t = out[j];
        if (distToLine(s, t.a) > tol || distToLine(s, t.b) > tol) continue;
        const ends = [s.a, s.b, t.a, t.b];
        const touching = ends.slice(0, 2).some((p) => ends.slice(2).some((q) => dist(p, q) <= tol));
        if (!touching) continue;
        // The two ends furthest apart span the joined piece.
        let best = { a: s.a, b: s.b };
        for (const p of ends) for (const q of ends) if (dist(p, q) > dist(best.a, best.b)) best = { a: p, b: q };
        out[i] = best;
        out.splice(j, 1);
        merged = true;
        break outer;
      }
  }
  return out;
}

/** Compares the drawing with the target figure. Lines along the frame or along given lines are no mistake. */
export function checkDrawing(
  drawn: readonly Segment[],
  targets: readonly Segment[],
  frame: Frame,
  given: readonly Segment[] = [],
): CheckResult {
  const there = [...frameSides(frame), ...given];
  const allowed = [...targets, ...there];
  // A target line along the frame or a given line is there already.
  const cover = [...drawn, ...there];
  const gaps = targets.map((t) => uncovered(t, cover));
  const missing = joinStraight(gaps.flat());
  const wrong = drawn.map((d) => uncovered(d, allowed));
  const extra = joinStraight(wrong.flat());
  // The green band needs no joining: drawn pieces minus their wrong parts.
  const correct = drawn.flatMap((d, i) => (wrong[i].length ? uncovered(d, wrong[i]) : [d]));
  // Counted in whole target lines; those along the frame or a given line are there already.
  const toDraw = targets.map((_, i) => i).filter((i) => uncovered(targets[i], there).length > 0);
  const right = toDraw.filter((i) => gaps[i].length === 0).length;
  return { missing, extra, correct, total: toDraw.length, right, done: missing.length === 0 && extra.length === 0 };
}

export interface FillResult {
  /** Areas that should be filled in but are not. */
  missing: Vec[][];
  /** Areas filled in that should stay white. */
  extra: Vec[][];
}

/**
 * Compares filled areas with the target: every face of the drawing whose inside lies in a
 * target area must be painted (in any colour), every other face must stay white.
 */
export function checkFills(all: readonly Vec[][], filledAt: (p: Vec) => boolean, areas: readonly Vec[][]): FillResult {
  const result: FillResult = { missing: [], extra: [] };
  for (const face of all) {
    const inside = interiorPoint(face);
    const wanted = areas.some((a) => insidePolygon(a, inside));
    // Any colour counts: what matters is that the area is painted.
    const filled = filledAt(inside);
    if (wanted && !filled) result.missing.push(face);
    if (filled && !wanted) result.extra.push(face);
  }
  return result;
}

/** For tests and old data: "filled" means the face of one of the tapped points. */
export const filledBySeeds =
  (all: readonly Vec[][], seeds: readonly Vec[]) =>
  (p: Vec): boolean => {
    const face = faceAt(all, p);
    return !!face && seeds.some((s) => faceAt(all, s) === face);
  };
