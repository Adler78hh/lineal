import { type Vec, scale, sub } from './vec';
import { type RulerPose, rotateRuler, translateRuler } from './ruler';

/** A rigid motion: first turn by `rotation` around `pivot`, then shift by `translation`. */
export interface Motion {
  pivot: Vec;
  rotation: number;
  translation: Vec;
}

const angleOf = (v: Vec) => Math.atan2(v.y, v.x);
const mid = (a: Vec, b: Vec): Vec => scale({ x: a.x + b.x, y: a.y + b.y }, 0.5);

/** The motion that two fingers made going from (a0, b0) to (a1, b1): turn with them, follow their middle. */
export function twoFingerMotion(a0: Vec, b0: Vec, a1: Vec, b1: Vec): Motion {
  const m0 = mid(a0, b0);
  return {
    pivot: m0,
    rotation: angleOf(sub(b1, a1)) - angleOf(sub(b0, a0)),
    translation: sub(mid(a1, b1), m0),
  };
}

/** Turning around `pivot` so that a point under the finger moves from `p0` to `p1`. */
export function turnMotion(pivot: Vec, p0: Vec, p1: Vec): Motion {
  return { pivot, rotation: angleOf(sub(p1, pivot)) - angleOf(sub(p0, pivot)), translation: { x: 0, y: 0 } };
}

export const applyMotion = (r: RulerPose, m: Motion): RulerPose =>
  translateRuler(rotateRuler(r, m.pivot, m.rotation), m.translation);
