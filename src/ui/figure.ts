import type { CheckResult, FillResult } from '../geometry/check';
import { labelDirection, markDirection } from '../geometry/marks';
import type { Task } from '../geometry/task';
import { type Segment, type Vec, vec } from '../geometry/vec';
import { type Viewport, fitViewport } from '../geometry/viewport';
import { fmt, svgEl } from './svg';

export interface FigureOptions {
  /** Small template (thin lines, target figure) or large drawing board. */
  variant: 'target' | 'board';
  showGrid: boolean;
  /** Lines the child has drawn (board only). */
  drawn?: readonly Segment[];
  /** Crossings the child turned into grid points (board only). */
  made?: readonly Vec[];
  /** Areas the child has filled in (board only). */
  filled?: readonly Vec[][];
  /** After "Prüfen": missing parts dashed, extra parts marked (board only). */
  feedback?: CheckResult | null;
  fillFeedback?: FillResult | null;
}

/**
 * Draws frame, grid points and – for the template – the target figure into `into`
 * (the svg itself or a layer of it), sized to fit the box of `svg`.
 */
export function renderFigure(svg: SVGSVGElement, into: SVGElement, task: Task, opts: FigureOptions): Viewport | null {
  const { width, height } = svg.getBoundingClientRect();
  into.replaceChildren();
  if (width < 1 || height < 1) return null;
  svg.setAttribute('viewBox', `0 0 ${fmt(width)} ${fmt(height)}`);

  const board = opts.variant === 'board';
  const pad = board ? 28 : 12;
  const vp = fitViewport(task.bounds, width, height, pad);
  const s = (p: Vec) => vp.toScreen(p);
  const points = (poly: readonly Vec[]) =>
    poly
      .map(s)
      .map((p) => `${fmt(p.x)},${fmt(p.y)}`)
      .join(' ');
  const polygons = (cls: string, list: readonly (readonly Vec[])[]) => {
    const g = svgEl('g', { class: cls }, into);
    for (const poly of list) svgEl('polygon', { points: points(poly) }, g);
  };
  const segments = (cls: string, list: readonly Segment[]) => {
    const g = svgEl('g', { class: cls }, into);
    for (const l of list) {
      const a = s(l.a);
      const b = s(l.b);
      svgEl('line', { x1: fmt(a.x), y1: fmt(a.y), x2: fmt(b.x), y2: fmt(b.y) }, g);
    }
  };

  // Filled areas lie under every line.
  if (board) {
    polygons('fills', opts.filled ?? []);
    if (opts.fillFeedback) {
      polygons('missing-fills', opts.fillFeedback.missing);
      polygons('extra-fills', opts.fillFeedback.extra);
    }
  } else {
    polygons('areas', task.areas);
  }

  const frame = svgEl('g', { class: 'frame' }, into);
  if (task.frame.kind === 'circle') {
    if (task.frame.visible) {
      const c = s(task.frame.center);
      svgEl('circle', { cx: fmt(c.x), cy: fmt(c.y), r: fmt(task.frame.r * vp.scale) }, frame);
    }
  } else if (task.frame.kind === 'polygon') {
    svgEl('polygon', { points: points(task.frame.vertices) }, frame);
  }
  for (const c of task.givenCircles) {
    const m = s(c.center);
    svgEl('circle', { cx: fmt(m.x), cy: fmt(m.y), r: fmt(c.r * vp.scale) }, frame);
  }
  segments('given-lines', task.givenLines);

  if (board) {
    // Extra parts get a soft red band under the pencil line, missing ones a dashed hint.
    if (opts.feedback) segments('extra-lines', opts.feedback.extra);
    segments('drawn-lines', opts.drawn ?? []);
    if (opts.feedback) segments('missing-lines', opts.feedback.missing);
  } else {
    segments('target-lines', task.targetLines);
  }

  if (opts.showGrid) {
    const grid = svgEl('g', { class: 'grid-points' }, into);
    const r = board ? 7 : 3;
    const tick = board ? { out: 13, in: 4 } : { out: 5, in: 1.5 };
    let marks = '';
    for (const p of task.gridPoints) {
      const q = s(p);
      const t = task.gridStyle === 'ticks' ? markDirection(task, p) : null;
      if (!t) {
        svgEl('circle', { cx: fmt(q.x), cy: fmt(q.y), r }, grid);
        continue;
      }
      // Corners of the frame need no mark; screen y points down.
      if (t.dir.x === 0 && t.dir.y === 0) continue;
      const d = vec(t.dir.x, -t.dir.y);
      const back = t.both ? tick.out : tick.in;
      marks += `M${fmt(q.x - d.x * back)},${fmt(q.y - d.y * back)}L${fmt(q.x + d.x * tick.out)},${fmt(q.y + d.y * tick.out)}`;
    }
    if (marks) svgEl('path', { class: 'grid-ticks', d: marks }, grid);
    // Names and numbers of points (board only: on the small template they would be unreadable).
    if (board && task.labels.length) {
      const names = svgEl('g', { class: 'point-labels' }, into);
      const size = task.labels.length > 30 ? 13 : 16;
      for (const l of task.labels) {
        const q = s(l.at);
        const d = labelDirection(task, l.at);
        const t = svgEl('text', { x: fmt(q.x + d.x * (size + 4)), y: fmt(q.y - d.y * (size + 4)), 'font-size': size }, names);
        t.textContent = l.text;
      }
    }
    for (const p of opts.made ?? []) {
      const q = s(p);
      svgEl('circle', { class: 'made', cx: fmt(q.x), cy: fmt(q.y), r }, grid);
    }
  }
  return vp;
}
