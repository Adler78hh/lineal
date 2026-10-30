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

/** Compares the drawing with the target figure. */
export function checkDrawing(drawn: readonly Segment[], targets: readonly Segment[], frame: Frame): CheckResult {
  const allowed = [...targets, ...(frame.kind === 'polygon' ? frameSides(frame) : [])];
  const missing = joinStraight(targets.flatMap((t) => uncovered(t, drawn)));
  const extra = joinStraight(drawn.flatMap((d) => uncovered(d, allowed)));
  return { missing, extra, done: missing.length === 0 && extra.length === 0 };
}
