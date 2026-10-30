import { type Motion, applyMotion, turnMotion, twoFingerMotion } from '../geometry/gesture';
import {
  type RulerPose,
  nearEdge,
  pointsOnEdge,
  rotateRuler,
  snapAroundPivot,
  snapRuler,
  translateRuler,
} from '../geometry/ruler';
import { type Vec, dist, len, samePoint, scale, sub } from '../geometry/vec';

/** Distances on screen, converted with the current zoom. */
export const RULER_PX = {
  /** A grid point closer than this to the drawing edge pulls the ruler onto it. */
  snap: 12,
  /** Pulling an anchored ruler further than this tears it loose. */
  release: 48,
  /** Grabbing closer than this to the pivot does not turn (the angle would jump). */
  minTurnRadius: 24,
  /** How close a tap must be to an orange point. */
  tap: 26,
};

/** Turning a fixed ruler with two fingers by more than this tears it loose too. */
const RELEASE_ANGLE = (15 * Math.PI) / 180;

/** What can be grabbed: the ruler itself or one of its turn handles. */
export type Grip = 'body' | 'handle';

/** free: no point holds the ruler. pivot: it turns around one point. fixed: two points hold it. */
export type RulerMode = 'free' | 'pivot' | 'fixed';

export interface RulerView {
  pose: RulerPose;
  /** Grid points on the drawing edge that hold the ruler (shown orange). */
  anchors: Vec[];
  /** Point held by a pin (long press): stays the pivot until tapped. */
  pinned: Vec | null;
  mode: RulerMode;
}

interface Gesture {
  grip: Grip;
  mode: RulerMode;
  pivot: Vec | null;
  /** Pose and finger positions when the gesture started or the number of fingers changed. */
  startPose: RulerPose;
  start: Map<number, Vec>;
  now: Map<number, Vec>;
}

const has = (list: readonly Vec[], p: Vec) => list.some((q) => samePoint(p, q));

/**
 * The ruler and the points that hold it, without any DOM, so it can be tested.
 *
 * - One anchor point: dragging turns the ruler around it.
 * - Two anchor points: the ruler is fixed.
 * - Pulling clearly away (`RULER_PX.release`) or tapping an orange point lets go.
 *   A point that was let go stays non-magnetic until the edge has left it.
 * - A pin (long press on an orange point) keeps that point the pivot, however hard one pulls,
 *   until it is tapped again.
 */
export class RulerModel {
  private pose: RulerPose;
  private anchors: Vec[] = [];
  private pinned: Vec | null = null;
  /** Points that were let go and do not snap until the edge has moved away from them. */
  private ignored: Vec[] = [];
  private pxPerUnit = 1;
  private gesture: Gesture | null = null;

  constructor(
    pose: RulerPose,
    private points: Vec[],
  ) {
    this.pose = pose;
    this.anchors = pointsOnEdge(pose, points);
  }

  /** Pixels per task unit, so the thresholds stay the same size on every screen. */
  setScale(pxPerUnit: number): void {
    this.pxPerUnit = pxPerUnit;
  }

  setPoints(points: Vec[]): void {
    this.points = points;
    this.anchors = pointsOnEdge(this.pose, this.magnetic());
  }

  get view(): RulerView {
    return { pose: this.pose, anchors: this.anchors, pinned: this.pinned, mode: this.restingMode() };
  }

  get dragging(): boolean {
    return this.gesture !== null;
  }

  // ---- gestures ----

  /** A finger (or the mouse) goes down on the ruler. */
  begin(grip: Grip, id: number, p: Vec): void {
    const mode = this.restingMode();
    this.gesture = {
      grip,
      mode,
      pivot: mode === 'pivot' ? (this.pinned ?? this.anchors[0]) : null,
      startPose: this.pose,
      start: new Map([[id, p]]),
      now: new Map([[id, p]]),
    };
  }

  /** A second finger joins the gesture (it may be anywhere). */
  addFinger(id: number, p: Vec): void {
    const g = this.gesture;
    if (!g || g.now.size >= 2) return;
    g.now.set(id, p);
    this.rebase();
  }

  move(id: number, p: Vec): void {
    const g = this.gesture;
    if (!g || !g.now.has(id)) return;
    g.now.set(id, p);
    this.update();
  }

  /** A finger lifts. With none left, the ruler stays where it is shown. */
  lift(id: number): void {
    const g = this.gesture;
    if (!g || !g.now.delete(id)) return;
    if (g.now.size > 0) {
      this.rebase();
      return;
    }
    this.gesture = null;
  }

  /** Mouse wheel: turns around the pivot, or around `p` if the ruler is free. A fixed ruler does not turn. */
  turn(p: Vec, delta: number): void {
    if (this.gesture) return;
    const mode = this.restingMode();
    if (mode === 'fixed') return;
    const pivot = mode === 'pivot' ? (this.pinned ?? this.anchors[0]) : p;
    const pose = rotateRuler(this.pose, pivot, delta);
    this.settle(mode === 'pivot' ? snapAroundPivot(pose, pivot, this.magnetic(), this.tol('snap')) : snapRuler(pose, this.magnetic(), this.tol('snap')));
  }

  // ---- taps on orange points ----

  /** The orange (or pinned) point near `p`, if any. */
  pointAt(p: Vec): Vec | null {
    const tol = this.tol('tap');
    const candidates = this.pinned ? [this.pinned, ...this.anchors] : this.anchors;
    let best: Vec | null = null;
    for (const q of candidates) if (dist(p, q) <= tol && (!best || dist(p, q) < dist(p, best))) best = q;
    return best;
  }

  /** Tapping an orange point lets it go; tapping the pin removes it. */
  tap(point: Vec): void {
    if (this.pinned && samePoint(point, this.pinned)) this.pinned = null;
    else if (!has(this.anchors, point)) return;
    this.letGo([point]);
    this.anchors = this.anchors.filter((q) => !samePoint(q, point));
  }

  /** Long press on an orange point pins it. */
  pin(point: Vec): void {
    if (!has(this.anchors, point)) return;
    this.pinned = point;
  }

  // ---- internals ----

  private tol(what: keyof typeof RULER_PX): number {
    return RULER_PX[what] / this.pxPerUnit;
  }

  private magnetic(): Vec[] {
    return this.points.filter((p) => !has(this.ignored, p));
  }

  private restingMode(): RulerMode {
    const others = this.pinned ? this.anchors.filter((q) => !samePoint(q, this.pinned!)) : this.anchors;
    const holding = others.length + (this.pinned ? 1 : 0);
    return holding >= 2 ? 'fixed' : holding === 1 ? 'pivot' : 'free';
  }

  private letGo(points: Vec[]): void {
    for (const p of points) if (!has(this.ignored, p)) this.ignored.push(p);
  }

  /** Takes over a snapped pose; forgets ignored points the edge has left. */
  private settle(s: { pose: RulerPose; points: Vec[] }): void {
    this.pose = s.pose;
    this.anchors = s.points;
    const tol = this.tol('snap');
    this.ignored = this.ignored.filter((p) => nearEdge(this.pose, p, tol));
    if (this.pinned && !has(this.anchors, this.pinned)) this.pinned = null;
  }

  /** Starts measuring again from here (the number of fingers changed, or the ruler was torn loose). */
  private rebase(): void {
    const g = this.gesture!;
    g.startPose = this.pose;
    g.start = new Map(g.now);
  }

  private fingers(): { a0: Vec; a1: Vec; b0?: Vec; b1?: Vec } {
    const g = this.gesture!;
    const [ia, ib] = [...g.now.keys()];
    return {
      a0: g.start.get(ia)!,
      a1: g.now.get(ia)!,
      b0: ib === undefined ? undefined : g.start.get(ib),
      b1: ib === undefined ? undefined : g.now.get(ib),
    };
  }

  private update(): void {
    const g = this.gesture!;
    const { a0, a1, b0, b1 } = this.fingers();
    const two = b0 && b1 ? twoFingerMotion(a0, b0, a1, b1) : null;
    const pull = this.tol('release');

    if (g.mode === 'fixed') {
      const shift = two ? len(two.translation) : dist(a0, a1);
      if (shift <= pull && (!two || Math.abs(two.rotation) <= RELEASE_ANGLE)) return;
      // Torn loose: the ruler jumps to where the fingers have pulled it.
      const torn = two ?? { pivot: a0, rotation: 0, translation: sub(a1, a0) };
      if (this.pinned) {
        this.letGo(this.anchors.filter((q) => !samePoint(q, this.pinned!)));
        this.anchors = [this.pinned];
        g.mode = 'pivot';
        g.pivot = this.pinned;
        this.rebase();
        return;
      }
      this.letGo(this.anchors);
      this.becomeFree(applyMotion(g.startPose, torn));
      return;
    }

    if (g.mode === 'pivot') {
      const c = g.pivot!;
      let rotation = 0;
      let excess: Vec | null = null;
      if (two) {
        rotation = two.rotation;
        if (len(two.translation) > pull) excess = two.translation;
      } else {
        const r0 = dist(a0, c);
        const r1 = dist(a1, c);
        if (Math.abs(r1 - r0) > pull) excess = scale(sub(a1, c), (r1 - r0) / Math.max(r1, 1e-9));
        // Body and handle both turn around the pivot.
        if (r0 >= this.tol('minTurnRadius')) rotation = turnMotion(c, a0, a1).rotation;
      }
      const turned = rotateRuler(g.startPose, c, rotation);
      if (excess && !this.pinned) {
        this.letGo([c]);
        this.becomeFree(translateRuler(turned, excess));
        return;
      }
      this.settle(snapAroundPivot(turned, c, this.magnetic(), this.tol('snap')));
      return;
    }

    // free
    let m: Motion;
    if (two) m = two;
    else if (g.grip === 'handle') m = turnMotion(g.startPose.origin, a0, a1);
    else m = { pivot: a0, rotation: 0, translation: sub(a1, a0) };
    this.settle(snapRuler(applyMotion(g.startPose, m), this.magnetic(), this.tol('snap')));
  }

  /** From now on the gesture moves the ruler freely, starting at `pose`. */
  private becomeFree(pose: RulerPose): void {
    const g = this.gesture!;
    g.mode = 'free';
    g.pivot = null;
    this.settle(snapRuler(pose, this.magnetic(), this.tol('snap')));
    this.rebase();
  }
}
