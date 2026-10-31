import { frameSides } from './frame';
import { addLine } from './segments';
import type { Frame } from './task';
import { EPS, type Segment, type Vec, samePoint, vec } from './vec';

/** Signed area: positive when the corners run counter-clockwise. */
export function polygonArea(poly: readonly Vec[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function insidePolygon(poly: readonly Vec[], p: Vec): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** A point well inside a (simple) polygon: the middle of the first stretch a horizontal line has inside it. */
export function interiorPoint(poly: readonly Vec[]): Vec {
  const ys = poly.map((p) => p.y);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  // Slightly off the middle, so the line does not run through a corner.
  const y = lo + (hi - lo) * 0.5000123;
  const xs: number[] = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
  }
  xs.sort((m, n) => m - n);
  let best = { x: xs[0] ?? poly[0].x, w: -1 };
  for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > best.w) best = { x: (xs[i] + xs[i + 1]) / 2, w: xs[i + 1] - xs[i] };
  return vec(best.x, y);
}

/**
 * The lines that bound areas: the drawing, the frame and the given lines.
 * A circle frame is approximated by many short sides that run through every point on it.
 */
export function boundaryLines(frame: Frame, given: readonly Segment[], drawn: readonly Segment[], points: readonly Vec[]): Segment[] {
  const out = [...frameSides(frame), ...given, ...drawn];
  if (frame.kind === 'circle' && frame.visible) {
    const { center: c, r } = frame;
    const on = [...points, ...drawn.flatMap((s) => [s.a, s.b])].filter((p) => Math.abs(Math.hypot(p.x - c.x, p.y - c.y) - r) < 1e-6);
    const angles = [...on.map((p) => Math.atan2(p.y - c.y, p.x - c.x)), ...Array.from({ length: 120 }, (_, k) => (k / 120) * 2 * Math.PI - Math.PI)];
    const ring = [...on, ...angles.slice(on.length).map((t) => vec(c.x + r * Math.cos(t), c.y + r * Math.sin(t)))];
    const order = ring.map((p, i) => ({ p, t: angles[i] })).sort((m, n) => m.t - n.t);
    const pts: Vec[] = [];
    for (const { p } of order) if (!pts.some((q) => samePoint(p, q))) pts.push(p);
    pts.forEach((p, i) => out.push({ a: p, b: pts[(i + 1) % pts.length] }));
  }
  return out;
}

/** The closed areas (faces) the lines enclose, as counter-clockwise polygons. */
export function faces(lines: readonly Segment[]): Vec[][] {
  const pieces = lines.reduce<Segment[]>((acc, l) => addLine(acc, l, []), []);
  const verts: Vec[] = [];
  const id = (p: Vec) => {
    let i = verts.findIndex((q) => samePoint(p, q));
    if (i < 0) i = verts.push(p) - 1;
    return i;
  };
  // Half-edges u→v; around every corner the outgoing ones sorted by angle.
  const out = new Map<number, { to: number; angle: number }[]>();
  const add = (u: number, v: number) => {
    const list = out.get(u) ?? [];
    list.push({ to: v, angle: Math.atan2(verts[v].y - verts[u].y, verts[v].x - verts[u].x) });
    out.set(u, list);
  };
  for (const s of pieces) {
    const u = id(s.a);
    const v = id(s.b);
    if (u === v) continue;
    add(u, v);
    add(v, u);
  }
  for (const list of out.values()) list.sort((m, n) => m.angle - n.angle);

  const seen = new Set<string>();
  const result: Vec[][] = [];
  for (const [u0, list] of out)
    for (const { to: v0 } of list) {
      if (seen.has(`${u0}>${v0}`)) continue;
      // Walk with the face on the left: at each corner take the edge just clockwise of the way back.
      const cycle: number[] = [];
      let u = u0;
      let v = v0;
      for (let guard = 0; guard < 100000 && !seen.has(`${u}>${v}`); guard++) {
        seen.add(`${u}>${v}`);
        cycle.push(u);
        const around = out.get(v)!;
        const back = around.findIndex((e) => e.to === u);
        const next = around[(back - 1 + around.length) % around.length].to;
        u = v;
        v = next;
      }
      const poly = cycle.map((i) => verts[i]);
      if (polygonArea(poly) > EPS) result.push(poly);
    }
  return result;
}

/** The smallest face that contains `p`. */
export function faceAt(all: readonly Vec[][], p: Vec): Vec[] | null {
  let best: Vec[] | null = null;
  for (const f of all) if (insidePolygon(f, p) && (!best || polygonArea(f) < polygonArea(best))) best = f;
  return best;
}
