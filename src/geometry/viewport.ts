import type { Bounds, Vec } from './vec';

/** Maps task coordinates (y up) to screen pixels (y down) and back. */
export interface Viewport {
  /** Pixels per task unit. */
  scale: number;
  toScreen(p: Vec): Vec;
  toWorld(p: Vec): Vec;
}

/** Fits `bounds` centred into a `width` × `height` pixel area, keeping `pad` pixels free on every side. */
export function fitViewport(bounds: Bounds, width: number, height: number, pad: number): Viewport {
  const bw = Math.max(bounds.maxX - bounds.minX, 1e-9);
  const bh = Math.max(bounds.maxY - bounds.minY, 1e-9);
  const scale = Math.max(Math.min((width - 2 * pad) / bw, (height - 2 * pad) / bh), 1e-9);
  const ox = (width - bw * scale) / 2 - bounds.minX * scale;
  const oy = (height + bh * scale) / 2 + bounds.minY * scale;
  return {
    scale,
    toScreen: (p) => ({ x: ox + p.x * scale, y: oy - p.y * scale }),
    toWorld: (p) => ({ x: (p.x - ox) / scale, y: (oy - p.y) / scale }),
  };
}
