import type { V3 } from '../../lib/math';
import type { ScriptedActor } from '../actors/actor';
import { cellOf, type Cell } from './cell';
import { checkPose, densityFor, project, viewOf, zoomOf, type CameraPose } from './pose';

/**
 * The stage frame: scripted actors at a time under a passed-in camera pose, as the painted cells a scene draws and
 * where each lands. `compose` is the CPU reference that frame is checked against (the GPU's readback must equal it,
 * `npm run view-check`) and replaces the compositor each showcase wrote by hand. Pure TypeScript: no Pixi, no DOM.
 */

/** The contract's version: a whole number, raised on any breaking change to the types in docs/contract.md or to
 * src/kit.ts. */
export const STAGE_VERSION = 1;

/** One figure in a frame: its cell, its feet in the world, where its cell's top-left lands on screen, how many screen
 * pixels one texel covers, and its distance along the view (the draw order: far first, then cast order). */
export interface StageSprite { name: string; cell: Cell; at: V3; screen: [x: number, y: number]; scale: number; depth: number }
export interface StageFrame { version: number; camera: CameraPose; sprites: StageSprite[] }

export interface StageOptions {
  /** Whole pixels per texel and the quad on the pixel grid (The Last Light's `?crisp=figures`). Off: true scale. */
  crisp?: boolean;
  /** The highest density a figure is painted at (4 by default; the gameplay camera's is 1). */
  maxDensity?: number;
}

/** A zoom that is a whole number to 1e-9 (a host's `pixelsPerMetre` need not round-trip) is that whole number. */
const settled = (zoom: number) => Math.abs(zoom - Math.round(zoom)) < 1e-9 && Math.round(zoom) >= 1 ? Math.round(zoom) : zoom;

/**
 * Draws each actor at `t` under the pose's view and its density, places it, and sorts far to near. Deterministic: the
 * same arguments give the same frame, whatever was drawn before. An actor behind the camera (under perspective, nearer
 * than 0.1 m) is left out.
 *
 * Placement, per actor: its feet `at3` project to `[ax, ay]`, `d` metres along the view; its `zoom` is `zoomOf`.
 * Default: the figure is painted at `densityFor(zoom)` and drawn at `scale = zoom / density`, true to scale. Crisp: `n =
 * max(1, round(zoom))` pixels a D1 texel, density `densityFor(n)`, `scale = n / density`. The cell's top-left is the
 * anchor's pixel less `scale × anchor`; it is rounded to a whole pixel when crisp or when the scale is whole. Ties in
 * `d` fall to cast order.
 */
export function stageFrame(actors: readonly ScriptedActor[], t: number, pose: CameraPose, opts: StageOptions = {}): StageFrame {
  checkPose(pose);
  const max = opts.maxDensity ?? 4, placed: { s: StageSprite; index: number }[] = [];
  actors.forEach((actor, index) => {
    const [x, z] = actor.state(t).at, at: V3 = [x, actor.ground(x, z), z], [ax, ay, d] = project(pose, at);
    if (pose.f !== undefined && d < 0.1) return;
    const raw = settled(zoomOf(pose, at)), zoom = opts.crisp ? Math.max(1, Math.round(raw)) : raw, density = densityFor(zoom, max);
    const cell = cellOf(actor.draw(t, viewOf(pose, at), density)), scale = zoom / density;
    const top: [number, number] = [ax - scale * cell.anchor[0], ay - scale * cell.anchor[1]];
    const screen: [number, number] = opts.crisp || Number.isInteger(scale) ? [Math.round(top[0]), Math.round(top[1])] : top;
    placed.push({ s: { name: actor.name, cell, at, screen, scale, depth: d }, index });
  });
  placed.sort((a, b) => b.s.depth - a.s.depth || a.index - b.index);
  return { version: STAGE_VERSION, camera: pose, sprites: placed.map(p => p.s) };
}

/**
 * The CPU reference: an RGBA frame of `camera.size`, transparent where empty, each sprite blitted nearest-neighbour at
 * its `scale` with its top-left at `screen`, in the frame's order (far to near, the later of a tie on top). It goes by
 * pixel centres, the GPU's rule: a pixel takes texel `(floor((px + 0.5 − x) / scale), floor((py + 0.5 − y) / scale))`
 * when that texel is in the cell and its alpha is set. A sprite off the frame writes nothing.
 */
export function compose(frame: StageFrame): Uint8ClampedArray {
  const [W, H] = frame.camera.size, out = new Uint8ClampedArray(W * H * 4);
  for (const { cell, screen: [sx, sy], scale: k } of frame.sprites) {
    const [w, h] = cell.size, px = cell.rgba;
    const x0 = Math.max(0, Math.floor(sx - 0.5)), x1 = Math.min(W, Math.ceil(sx + k * w + 0.5));
    const y0 = Math.max(0, Math.floor(sy - 0.5)), y1 = Math.min(H, Math.ceil(sy + k * h + 0.5));
    for (let y = y0; y < y1; y++) {
      const v = Math.floor((y + 0.5 - sy) / k);
      if (v < 0 || v >= h) continue;
      for (let x = x0; x < x1; x++) {
        const u = Math.floor((x + 0.5 - sx) / k);
        if (u < 0 || u >= w) continue;
        const i = (v * w + u) * 4;
        if (px[i + 3]) out.set(px.subarray(i, i + 4), (y * W + x) * 4);
      }
    }
  }
  return out;
}
