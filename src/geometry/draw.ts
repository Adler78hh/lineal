import { frameCrossings, insideFrame } from './frame';
import { type RulerPose, edgeCoords, pointsOnEdge, rulerPoint } from './ruler';
import { segmentIntersection } from './intersect';
import { collinear, onSegment } from './segments';
import type { Frame } from './task';
import { type Segment, type Vec, uniquePoints } from './vec';

/** The straight line of the drawing edge, long enough to cross any frame. */
export const edgeLine = (r: RulerPose, reach = 1000): Segment => ({
  a: rulerPoint(r, -reach, 0),
  b: rulerPoint(r, reach, 0),
});

/**
 * The points on the line of the drawing edge where a drawn line may end: grid points on it,
 * crossings with the frame border and with lines already drawn. Only those inside the frame.
 */
export function edgeStops(r: RulerPose, frame: Frame, points: readonly Vec[], pieces: readonly Segment[]): Vec[] {
  const edge = edgeLine(r);
  const stops: Vec[] = [...pointsOnEdge(r, points), ...frameCrossings(edge, frame)];
  for (const piece of pieces) {
    const x = segmentIntersection(edge, piece);
    if (x) stops.push(x);
    else if (collinear(edge, piece)) stops.push(...[piece.a, piece.b].filter((p) => onSegment(edge, p)));
  }
  return uniquePoints(stops.filter((p) => insideFrame(frame, p)));
}

/**
 * Turns a swipe along the ruler into a line: the swipe is projected onto the edge and
 * each end goes to the nearest stop. Too short a swipe, or both ends at the same stop: no line.
 */
export function strokeToLine(r: RulerPose, stroke: readonly Vec[], stops: readonly Vec[], minLength: number): Segment | null {
  if (stroke.length === 0 || stops.length < 2) return null;
  const ts = stroke.map((p) => edgeCoords(r, p).t);
  const from = Math.min(...ts);
  const to = Math.max(...ts);
  if (to - from < minLength) return null;
  const nearest = (t: number) =>
    stops.reduce((best, p) => (Math.abs(edgeCoords(r, p).t - t) < Math.abs(edgeCoords(r, best).t - t) ? p : best));
  const a = nearest(from);
  const b = nearest(to);
  return a === b ? null : { a, b };
}
