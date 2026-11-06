import { tapPoints } from '../geometry/crossings';
import { edgeStops, strokeToLine } from '../geometry/draw';
import { RULER, type RulerPose, edgeCoords, rulerCorners, rulerPoint } from '../geometry/ruler';
import type { Task } from '../geometry/task';
import { type Segment, type Vec, dist, samePoint, vec } from '../geometry/vec';
import type { Viewport } from '../geometry/viewport';
import { type Grip, RulerModel } from '../state/rulerModel';
import type { Tool } from '../state/store';
import { fmt, svgEl } from './svg';

/** Where the turn handles sit along the edge, measured from its middle (task units). */
const HANDLE_T = 5.5;
const HANDLE_R_PX = 22;
const WHEEL_STEP = (5 * Math.PI) / 180;
const LONG_PRESS_MS = 600;
/** A finger on an orange point that moves further than this is dragging, not tapping. */
const TAP_SLOP_PX = 10;
/** Drawing starts this close to the edge: mostly beside the ruler, a little on it (like a pencil tip). */
const PEN_OUTSIDE_PX = 40;
const PEN_INSIDE_PX = 8;
/** Shorter swipes are no line. */
const MIN_STROKE_PX = 14;
/** A tap: lifted within this time, having moved no more than TAP_SLOP_PX. */
const TAP_MS = 500;
/** How close a tap must be to a crossing. */
const CROSSING_TAP_PX = 26;
/** The eraser takes lines this close to the finger. */
const ERASER_PX = 18;

/** What a finger is about to do: move the ruler (body/handle) or draw along it. */
type Action = Grip | 'pen';

function startPose(task: Task): RulerPose {
  const b = task.bounds;
  // Turned half round, so it lies as one puts a ruler down: scale and drawing edge on top.
  return { origin: vec((b.minX + b.maxX) / 2, b.minY + (b.maxY - b.minY) * 0.42), angle: Math.PI };
}

/** A finger that went down on an orange point: a tap, a long press (pin) or the start of a drag. */
interface Press {
  id: number;
  at: Vec;
  client: Vec;
  point: Vec;
  action: Action | null;
  timer: number;
}

interface Stroke {
  id: number;
  points: Vec[];
}

/** A finger wiping with the eraser. */
interface Wipe {
  id: number;
  last: Vec;
  /** Something was erased already: the rest of the wipe belongs to the same undo step. */
  changed: boolean;
}

/** The first finger down, as long as it might still be a tap. */
interface Tap {
  id: number;
  at: Vec;
  client: Vec;
  time: number;
  moved: boolean;
}

/**
 * Input on the drawing board, and the ruler on it.
 * - Ruler: one finger (or the mouse) drags, two fingers turn, the round handles and the mouse wheel turn.
 *   Tapping an orange point lets it go, a long press pins it.
 * - Pen: a swipe along the drawing edge draws a line; `onLine` receives it.
 * - Crossings: tapping where two drawn lines cross shows a "+"; tapping the "+" hands the
 *   crossing to `onMakePoint`, which turns it into a grid point.
 * - Eraser (tool 'eraser'): tapping or wiping over a line hands each point to `onErase`;
 *   the ruler rests meanwhile.
 */
export class Board {
  private model: RulerModel | null = null;
  private task: Task | null = null;
  private lines: readonly Segment[] = [];
  private points: readonly Vec[] = [];
  private vp: Viewport | null = null;
  private visible = true;
  private tool: Tool = 'ruler';
  private wipe: Wipe | null = null;
  private press: Press | null = null;
  private stroke: Stroke | null = null;
  private tapping: Tap | null = null;
  /** The crossing that shows a "+". */
  private offer: Vec | null = null;

  constructor(
    private svg: SVGSVGElement,
    private layer: SVGGElement,
    private marks: SVGGElement,
    private onLine: (line: Segment) => void,
    private onMakePoint: (p: Vec) => void,
    private onErase: (p: Vec, tol: number, newStep: boolean) => boolean,
    private onFill: (p: Vec) => void,
  ) {
    svg.addEventListener('pointerdown', (e) => this.down(e));
    svg.addEventListener('pointermove', (e) => this.move(e));
    svg.addEventListener('pointerup', (e) => this.up(e, false));
    svg.addEventListener('pointercancel', (e) => this.up(e, true));
    svg.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
  }

  /**
   * Called after every layout, task or drawing change.
   * `points` are all magnetic points: from the task and made from crossings.
   */
  update(task: Task, vp: Viewport | null, visible: boolean, lines: readonly Segment[], points: Vec[], tool: Tool): void {
    if (tool !== this.tool) {
      this.tool = tool;
      this.cancelPress();
      this.stroke = null;
      this.wipe = null;
      this.offer = null;
    }
    if (task.id !== this.task?.id || !this.model) {
      this.cancelPress();
      this.stroke = null;
      this.tapping = null;
      this.offer = null;
      this.model = new RulerModel(startPose(task), points);
    } else if (points !== this.points) {
      this.model.setPoints(points);
    }
    this.task = task;
    this.lines = lines;
    this.points = points;
    if (this.offer && !tapPoints(lines, task, points).some((q) => samePoint(q, this.offer!))) this.offer = null;
    if (vp) this.model.setScale(vp.scale);
    this.vp = vp;
    this.visible = visible;
    this.render();
  }

  private world(e: PointerEvent | WheelEvent): Vec | null {
    if (!this.vp) return null;
    const box = this.svg.getBoundingClientRect();
    return this.vp.toWorld(vec(e.clientX - box.left, e.clientY - box.top));
  }

  private down(e: PointerEvent): void {
    const m = this.model;
    const p = this.world(e);
    if (!m || !p) return;
    const capture = () => {
      this.svg.setPointerCapture(e.pointerId);
      e.preventDefault();
    };

    if (this.tool === 'eraser') {
      if (this.wipe) return;
      this.wipe = { id: e.pointerId, last: p, changed: false };
      capture();
      // A tap takes exactly one stretch: the nearest.
      if (this.vp && this.onErase(p, ERASER_PX / this.vp.scale, true)) this.wipe.changed = true;
      this.render();
      return;
    }

    if (!this.tapping && !this.stroke && !this.press && !m.dragging) {
      this.tapping = { id: e.pointerId, at: p, client: vec(e.clientX, e.clientY), time: Date.now(), moved: false };
    } else {
      this.tapping = null;
    }
    // Filling only needs taps; the ruler rests meanwhile.
    if (!this.visible || this.tool === 'fill') {
      capture();
      return;
    }

    if (this.stroke) return;
    // A second finger may land anywhere: small hands cannot always fit both on the ruler.
    if (this.press) this.pressBecomesDrag();
    if (this.stroke) return;
    if (m.dragging) {
      m.addFinger(e.pointerId, p);
      capture();
      return;
    }

    const grip = ((e.target as Element).closest<SVGElement>('[data-part]')?.dataset.part ?? null) as Grip | null;
    const action: Action | null = this.atPen(p) ? 'pen' : grip;
    const point = m.pointAt(p);
    if (point) {
      const id = e.pointerId;
      this.press = {
        id,
        at: p,
        client: vec(e.clientX, e.clientY),
        point,
        action,
        timer: window.setTimeout(() => this.longPress(id), LONG_PRESS_MS),
      };
      capture();
      this.render();
    } else if (action === 'pen') {
      this.stroke = { id: e.pointerId, points: [p] };
      capture();
    } else if (action) {
      m.begin(action, e.pointerId, p);
      capture();
    }
  }

  /** Is `p` where a pencil would run along the drawing edge? */
  private atPen(p: Vec): boolean {
    if (!this.model || !this.vp) return false;
    const { t, d } = edgeCoords(this.model.view.pose, p);
    const dPx = d * this.vp.scale;
    return Math.abs(t) <= RULER.length / 2 && dPx >= -PEN_OUTSIDE_PX && dPx <= PEN_INSIDE_PX;
  }

  private move(e: PointerEvent): void {
    const m = this.model;
    const p = this.world(e);
    if (!m || !p) return;
    if (this.wipe && this.wipe.id === e.pointerId) {
      this.eraseAlong(this.wipe.last, p);
      this.wipe.last = p;
      this.render();
      return;
    }
    const tap = this.tapping;
    if (tap && tap.id === e.pointerId && Math.hypot(e.clientX - tap.client.x, e.clientY - tap.client.y) > TAP_SLOP_PX) tap.moved = true;
    const press = this.press;
    if (press && press.id === e.pointerId) {
      if (Math.hypot(e.clientX - press.client.x, e.clientY - press.client.y) <= TAP_SLOP_PX) return;
      this.pressBecomesDrag();
    }
    if (this.stroke && this.stroke.id === e.pointerId) {
      this.stroke.points.push(p);
      this.render();
      return;
    }
    if (!m.dragging) return;
    m.move(e.pointerId, p);
    this.render();
  }

  private up(e: PointerEvent, cancelled: boolean): void {
    const m = this.model;
    if (!m) return;
    if (this.wipe && this.wipe.id === e.pointerId) {
      this.wipe = null;
      this.render();
      return;
    }
    const tap = this.tapping?.id === e.pointerId ? this.tapping : null;
    if (tap) this.tapping = null;
    const tapped = tap !== null && !cancelled && !tap.moved && Date.now() - tap.time < TAP_MS;
    if (this.press && this.press.id === e.pointerId) {
      // A tap on an orange point is about the ruler, not about crossings.
      const { point } = this.press;
      this.cancelPress();
      if (!cancelled) m.tap(point);
    } else if (tapped) {
      this.stroke = null;
      m.lift(e.pointerId);
      if (this.tool === 'fill') this.onFill(tap.at);
      else this.tapCrossing(tap.at);
    } else if (this.stroke && this.stroke.id === e.pointerId) {
      const { points } = this.stroke;
      this.stroke = null;
      if (!cancelled) this.finishStroke(points);
    } else {
      m.lift(e.pointerId);
    }
    this.render();
  }

  private wheel(e: WheelEvent): void {
    const p = this.world(e);
    if (!this.visible || !this.model || !p || this.stroke || this.tool !== 'ruler') return;
    if (!(e.target as Element).closest('[data-part]')) return;
    e.preventDefault();
    this.model.turn(p, e.deltaY > 0 ? -WHEEL_STEP : WHEEL_STEP);
    this.render();
  }

  private longPress(id: number): void {
    if (!this.model || !this.press || this.press.id !== id) return;
    this.model.pin(this.press.point);
    this.cancelPress();
    navigator.vibrate?.(30);
    this.render();
  }

  /** The finger on the orange point moved (or a second one came): it draws or drags after all. */
  private pressBecomesDrag(): void {
    const press = this.press!;
    this.cancelPress();
    if (press.action === 'pen') this.stroke = { id: press.id, points: [press.at] };
    else if (press.action) this.model!.begin(press.action, press.id, press.at);
  }

  /** Wiping: erases every stretch the eraser passes on its way from `a` to `b`. */
  private eraseAlong(a: Vec, b: Vec): void {
    const w = this.wipe;
    if (!w || !this.vp) return;
    const tol = ERASER_PX / this.vp.scale;
    const steps = Math.max(1, Math.ceil(dist(a, b) / (tol / 2)));
    for (let i = 1; i <= steps; i++) {
      const p = vec(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
      // One stretch per call; keep going while there is more to take at this spot.
      while (this.onErase(p, tol, !w.changed)) w.changed = true;
    }
  }

  /** Tapping a crossing offers a "+", tapping the "+" makes the crossing a grid point; tapping elsewhere closes it. */
  private tapCrossing(p: Vec): void {
    if (!this.vp) return;
    const tol = CROSSING_TAP_PX / this.vp.scale;
    if (this.offer && dist(p, this.offer) <= tol) {
      const made = this.offer;
      this.offer = null;
      this.onMakePoint(made);
      return;
    }
    let best: Vec | null = null;
    for (const q of tapPoints(this.lines, this.task!, this.points))
      if (dist(p, q) <= tol && (!best || dist(p, q) < dist(p, best))) best = q;
    this.offer = best;
  }

  private finishStroke(points: Vec[]): void {
    if (!this.model || !this.task || !this.vp) return;
    const pose = this.model.view.pose;
    // Given lines are stops too, like the frame.
    const stops = edgeStops(pose, this.task.frame, this.points, [...this.lines, ...this.task.givenLines]);
    const line = strokeToLine(pose, points, stops, MIN_STROKE_PX / this.vp.scale);
    if (line) this.onLine(line);
  }

  private cancelPress(): void {
    if (this.press) window.clearTimeout(this.press.timer);
    this.press = null;
  }

  private render(): void {
    this.layer.replaceChildren();
    this.marks.replaceChildren();
    if (this.visible) this.renderRuler();
    this.renderOffer();
    if (this.wipe && this.vp) {
      const q = this.vp.toScreen(this.wipe.last);
      svgEl('circle', { class: 'eraser-spot', cx: fmt(q.x), cy: fmt(q.y), r: ERASER_PX }, this.marks);
    }
  }

  private renderOffer(): void {
    if (!this.offer || !this.vp) return;
    const q = this.vp.toScreen(this.offer);
    const g = svgEl('g', { class: 'cross-offer', transform: `translate(${fmt(q.x)} ${fmt(q.y)})` }, this.marks);
    svgEl('circle', { class: 'halo', r: 22 }, g);
    const badge = svgEl('g', { class: 'badge' }, g);
    svgEl('circle', { r: 13 }, badge);
    svgEl('path', { d: 'M -6 0 H 6 M 0 -6 V 6' }, badge);
  }

  private renderRuler(): void {
    const vp = this.vp;
    if (!vp || !this.model) return;
    const { pose: r, anchors, pinned, mode } = this.model.view;
    const s = (p: Vec) => vp.toScreen(p);
    const xy = (p: Vec) => `${fmt(s(p).x)},${fmt(s(p).y)}`;

    this.layer.setAttribute('class', `ruler ruler-${mode}${this.tool === 'ruler' ? '' : ' ruler-idle'}`);
    svgEl('polygon', { class: 'ruler-body', 'data-part': 'body', points: rulerCorners(r).map(xy).join(' ') }, this.layer);

    let ticks = '';
    const half = RULER.length / 2;
    for (let k = 0; k <= RULER.length * 2; k++) {
      const t = -half + k / 2;
      ticks += `M${xy(rulerPoint(r, t, 0))}L${xy(rulerPoint(r, t, k % 2 === 0 ? 0.45 : 0.25))}`;
    }
    svgEl('path', { class: 'ruler-ticks', d: ticks }, this.layer);
    svgEl('line', { class: 'ruler-edge', ...lineAttrs(s(rulerPoint(r, -half, 0)), s(rulerPoint(r, half, 0))) }, this.layer);

    for (const t of [-HANDLE_T, HANDLE_T]) {
      const c = s(rulerPoint(r, t, RULER.width * 0.55));
      const g = svgEl('g', { class: 'ruler-handle', 'data-part': 'handle', transform: `translate(${fmt(c.x)} ${fmt(c.y)})` }, this.layer);
      svgEl('circle', { r: HANDLE_R_PX }, g);
      // A round arrow: "turn me".
      svgEl('path', { d: 'M -9 -3 A 10 10 0 1 1 -3 9', class: 'arrow' }, g);
      svgEl('path', { d: 'M -14 -8 L -9 -3 L -4 -9', class: 'arrow' }, g);
    }

    for (const p of anchors) {
      const q = s(p);
      const isPin = pinned !== null && samePoint(p, pinned);
      svgEl('circle', { class: isPin ? 'snap-mark pinned' : 'snap-mark', cx: fmt(q.x), cy: fmt(q.y), r: 13 }, this.marks);
    }
    if (pinned) {
      // A pin stuck into the point, its head leaning away from the ruler body.
      const q = s(pinned);
      const n = vp.toScreen(rulerPoint(r, 0, -1));
      const o = vp.toScreen(r.origin);
      const away = Math.atan2(n.y - o.y, n.x - o.x) - Math.PI / 5;
      const head = vec(q.x + 30 * Math.cos(away), q.y + 30 * Math.sin(away));
      const g = svgEl('g', { class: 'pin' }, this.marks);
      svgEl('line', { ...lineAttrs(q, head) }, g);
      svgEl('circle', { cx: fmt(head.x), cy: fmt(head.y), r: 10 }, g);
    }
    if (this.stroke) {
      // While swiping: the part of the edge the pencil has covered so far.
      const ts = this.stroke.points.map((p) => edgeCoords(r, p).t);
      const from = Math.max(Math.min(...ts), -half);
      const to = Math.min(Math.max(...ts), half);
      svgEl('line', { class: 'stroke-preview', ...lineAttrs(s(rulerPoint(r, from, 0)), s(rulerPoint(r, to, 0))) }, this.marks);
    }
    if (this.press) {
      const q = s(this.press.point);
      svgEl('circle', { class: 'press-ring', cx: fmt(q.x), cy: fmt(q.y), r: 19, pathLength: 100 }, this.marks);
    }
  }
}

const lineAttrs = (a: Vec, b: Vec) => ({ x1: fmt(a.x), y1: fmt(a.y), x2: fmt(b.x), y2: fmt(b.y) });
