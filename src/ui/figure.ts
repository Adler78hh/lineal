import type { CheckResult } from '../geometry/check';
import type { Task } from '../geometry/task';
import type { Segment, Vec } from '../geometry/vec';
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
  /** After "Prüfen": missing parts dashed, extra parts marked (board only). */
  feedback?: CheckResult | null;
}

/**
 * Draws frame, grid points and – for the template – the target lines into `into`
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

  const frame = svgEl('g', { class: 'frame' }, into);
  if (task.frame.kind === 'circle') {
    const c = s(task.frame.center);
    svgEl('circle', { cx: fmt(c.x), cy: fmt(c.y), r: fmt(task.frame.r * vp.scale) }, frame);
  } else {
    const pts = task.frame.vertices.map(s).map((p) => `${fmt(p.x)},${fmt(p.y)}`);
    svgEl('polygon', { points: pts.join(' ') }, frame);
  }

  const segments = (cls: string, list: readonly Segment[]) => {
    const g = svgEl('g', { class: cls }, into);
    for (const l of list) {
      const a = s(l.a);
      const b = s(l.b);
      svgEl('line', { x1: fmt(a.x), y1: fmt(a.y), x2: fmt(b.x), y2: fmt(b.y) }, g);
    }
  };
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
    for (const p of task.gridPoints) {
      const q = s(p);
      svgEl('circle', { cx: fmt(q.x), cy: fmt(q.y), r }, grid);
    }
    for (const p of opts.made ?? []) {
      const q = s(p);
      svgEl('circle', { class: 'made', cx: fmt(q.x), cy: fmt(q.y), r }, grid);
    }
  }
  return vp;
}
