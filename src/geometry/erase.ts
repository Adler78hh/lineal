import { crossingPoints } from './crossings';
import { collinear, distToSegment } from './segments';
import { type Segment, type Vec, samePoint } from './vec';

/**
 * The pieces that belong to the stretch between the two nearest stops around piece `start`:
 * the drawing may also be cut where nothing stops (e.g. where an erased line used to cross),
 * so straight neighbours are followed through such joints.
 */
export function stretchAround(pieces: readonly Segment[], start: number, stops: readonly Vec[]): number[] {
  const taken = new Set([start]);
  const isStop = (p: Vec) => stops.some((q) => samePoint(p, q));
  const walk = (from: Vec, along: Segment) => {
    let at = from;
    let cur = along;
    while (!isStop(at)) {
      const next = pieces.findIndex(
        (s, i) => !taken.has(i) && (samePoint(s.a, at) || samePoint(s.b, at)) && collinear(s, cur),
      );
      if (next < 0) return;
      taken.add(next);
      cur = pieces[next];
      at = samePoint(cur.a, at) ? cur.b : cur.a;
    }
  };
  walk(pieces[start].a, pieces[start]);
  walk(pieces[start].b, pieces[start]);
  return [...taken];
}

/**
 * The eraser at `p`: removes the stretch of the nearest line within `tol`, between the
 * two nearest grid or crossing points. Returns null if no line is that close.
 */
export function eraseAt(pieces: readonly Segment[], p: Vec, tol: number, points: readonly Vec[]): Segment[] | null {
  let hit = -1;
  let best = tol;
  pieces.forEach((s, i) => {
    const d = distToSegment(s, p);
    if (d <= best) {
      best = d;
      hit = i;
    }
  });
  if (hit < 0) return null;
  const stops = [...points, ...crossingPoints(pieces, points)];
  const gone = new Set(stretchAround(pieces, hit, stops));
  return pieces.filter((_, i) => !gone.has(i));
}
