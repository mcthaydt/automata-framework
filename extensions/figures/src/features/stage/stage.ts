import type { V3 } from '../../lib/math'
import type { ScriptedActor } from '../actors/actor'
import type { FigureLight } from '../figure/figure'
import { lightFigure, type Lighting } from '../lighting/light'
import { lightSprite, type SpriteLighting } from '../lighting/sprite'
import { SPRITE_PITCH } from '../figure/frames'
import { cellOf, type Cell } from './cell'
import { checkPose, densityFor, project, viewOf, zoomOf, type CameraPose } from './pose'

/**
 * The stage frame: scripted actors at a time under a passed-in camera pose, as the painted cells a scene draws and
 * where each lands. `compose` is the CPU reference that frame is checked against (the GPU's readback must equal it,
 * `npm run view-check`) and replaces the compositor each showcase wrote by hand. Pure TypeScript: no Pixi, no DOM.
 */

/** The contract's version: a whole number, raised on any breaking change to the types in docs/contract.md or to
 * src/kit.ts. */
export const STAGE_VERSION = 1

/** One figure in a frame: its cell, its feet in the world, where its cell's top-left lands on screen, how many screen
 * pixels one texel covers, and its distance along the view (the draw order: far first, then cast order). */
export interface StageSprite {
  name: string
  cell: Cell
  at: V3
  screen: [x: number, y: number]
  scale: number
  depth: number
}
export interface StageFrame {
  version: number
  camera: CameraPose
  sprites: StageSprite[]
}

export interface StageOptions {
  /** Time of day, lamps (in world metres), bounce: the stage turns each lamp into the actor's view frame and has
   * `lightFigure` light the cell where the actor stands. Give `t` for a flicker or a light style. */
  lighting?: Lighting
  /** The other light path: a light per actor for the painter's light hook (an outside light per vertex, figure.ts
   * FigureLight), as EnvironmentBuilder's scene light does. With it no `lightFigure` runs. Not with `lighting`. */
  lights?: (actor: ScriptedActor) => FigureLight | null
  /** The third light path: the room's light on each actor, as `lightSprite` takes it (docs/contract.md section 3): `at` is the
   * actor's feet in the world, the lamps' `dir` are unit vectors toward them in the world, and the stage turns each into
   * the actor's lighting frame. `null` leaves that actor unlit. Not with `lighting` or `lights`. */
  sprite?: (actor: ScriptedActor, at: V3) => SpriteLighting | null
  /** The density every figure is painted at: 2 by default (FigureBuilder's working resolution, the renders' look), 1 or
   * 4 as asked, or `'auto'` to pick it from the zoom by `densityFor` (up to `maxDensity`), as the showcases did by hand. */
  density?: 1 | 2 | 4 | 'auto'
  /** Whole pixels per texel and the quad on the pixel grid (The Last Light's `?crisp=figures`). On by default (the
   * owner's call at the c6 visual gate); `crisp: false` is true scale: any real scale, the anchor unrounded. */
  crisp?: boolean
  /** The highest density `density: 'auto'` paints at (4 by default). */
  maxDensity?: number
  /** The pitch every figure is painted at (rad): `SPRITE_PITCH`, the renders' 18°, by default, whatever the camera's tilt. */
  pitch?: number
}

/** A world vector in the figure's lighting frame (x to the screen's right, y up, z toward the camera) for a figure seen
 * from `azimuth`: Ry(−azimuth), the inverse of world = Ry(azimuth) · cell. */
const turned = (v: V3, azimuth: number): V3 => {
  const c = Math.cos(-azimuth),
    s = Math.sin(-azimuth)
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]
}

/** The density figures are painted at unless the options say otherwise. */
const DEFAULT_DENSITY = 2

/** A zoom that is a whole number to 1e-9 (a host's `pixelsPerMetre` need not round-trip) is that whole number. */
const settled = (zoom: number) =>
  Math.abs(zoom - Math.round(zoom)) < 1e-9 && Math.round(zoom) >= 1 ? Math.round(zoom) : zoom

/**
 * Draws each actor at `t` under the pose's view and its density, places it, and sorts far to near. Deterministic: the
 * same arguments give the same frame, whatever was drawn before. An actor behind the camera (under perspective, nearer
 * than 0.1 m) is left out.
 *
 * Placement, per actor: its feet `at3` project to `[ax, ay]`, `d` metres along the view; its `zoom` is `zoomOf`.
 * The figure is painted at `opts.density` (D2 by default) and the view's bearing, at the renders' pitch (`SPRITE_PITCH`,
 * not the camera's tilt: a sprite drawn the way a classic 2.5D game draws it is not foreshortened by a tilted camera).
 * Crisp (the default): `scale = max(1, round(zoom / density))` whole pixels a texel, never minified. `crisp: false`:
 * `scale = zoom / density`, true to scale. With `density: 'auto'` the density follows the zoom: crisp, `n = max(1,
 * round(zoom))`, density `densityFor(n)`, `scale = n / density`; true scale, density `densityFor(zoom)`, `scale = zoom / density`. The cell's top-left is the
 * anchor's pixel less `scale × anchor`; it is rounded to a whole pixel when crisp or when the scale is whole. Ties in
 * `d` fall to cast order.
 *
 * Light (the cell's `rgba`; its `painted` stays unlit): with `opts.lighting` each lamp's `at` and `aim`, and the actor's
 * feet, are turned into the actor's lighting frame and `lightFigure` lights the cell with `at` there. With `opts.lights`
 * the light hook goes to `ScriptedActor.draw` and the painter lights the cell itself. With `opts.sprite` each lamp's world
 * direction is turned into the actor's lighting frame and `lightSprite` lights the cell. More than one of the three throws.
 */
export function stageFrame(
  actors: readonly ScriptedActor[],
  t: number,
  pose: CameraPose,
  opts: StageOptions = {},
): StageFrame {
  checkPose(pose)
  if (Number(!!opts.lighting) + Number(!!opts.lights) + Number(!!opts.sprite) > 1)
    throw new Error('stageFrame: lighting, lights and sprite are three light paths; give one')
  const max = opts.maxDensity ?? 4,
    crisp = opts.crisp ?? true,
    fixed = opts.density ?? DEFAULT_DENSITY,
    pitch = opts.pitch ?? SPRITE_PITCH,
    placed: { s: StageSprite; index: number }[] = []
  actors.forEach((actor, index) => {
    const [x, z] = actor.state(t).at,
      at: V3 = [x, actor.ground(x, z), z],
      [ax, ay, d] = project(pose, at)
    if (pose.f !== undefined && d < 0.1) return
    const raw = settled(zoomOf(pose, at))
    let density: number, scale: number
    if (fixed === 'auto') {
      const zoom = crisp ? Math.max(1, Math.round(raw)) : raw
      density = densityFor(zoom, max)
      scale = zoom / density
    } else {
      density = fixed
      scale = crisp ? Math.max(1, Math.round(raw / density)) : raw / density
    }
    const view = { ...viewOf(pose, at), pitch },
      figure = actor.draw(t, view, density, opts.lights?.(actor) ?? null)
    const L = opts.lighting,
      lamps = L?.lamps.map((l) => ({
        ...l,
        at: turned(l.at, view.azimuth),
        ...(l.aim && { aim: turned(l.aim, view.azimuth) }),
      }))
    const room = opts.sprite?.(actor, at),
      lit = L
        ? lightFigure(figure, { ...L, lamps: lamps!, at: turned(at, view.azimuth) })
        : room
          ? lightSprite(figure, {
              ...room,
              lamps: room.lamps.map((l) => ({ ...l, dir: turned(l.dir, view.azimuth) })),
            })
          : undefined
    const cell = cellOf(figure, lit)
    const top: [number, number] = [ax - scale * cell.anchor[0], ay - scale * cell.anchor[1]]
    const screen: [number, number] =
      crisp || Number.isInteger(scale) ? [Math.round(top[0]), Math.round(top[1])] : top
    placed.push({ s: { name: actor.name, cell, at, screen, scale, depth: d }, index })
  })
  placed.sort((a, b) => b.s.depth - a.s.depth || a.index - b.index)
  return { version: STAGE_VERSION, camera: pose, sprites: placed.map((p) => p.s) }
}

/** A surface a scene draws beside the figures (a wall, a floor): at the frame's pixel `(x, y)` (a pixel centre) its depth in
 * metres along the view and its colour, or null where it has none. `compose` depth-tests the figures against it. */
export type Backdrop = (
  x: number,
  y: number,
) => { depth: number; rgba: readonly [number, number, number, number] } | null

/**
 * The tie rule's step, in metres: the sprite at rank `i` in the frame (0 first) is tested at its texels' depths less
 * `(i + 1) · TIE_BIAS`, and the nearer test depth wins, strictly. So a later sprite beats an earlier one that is nearer by
 * less than the rank's difference in steps (an exact tie goes to the later, cast order), and a figure beats scene geometry
 * (a `Backdrop`) at the same depth or up to a step behind it. `compose` and the GPU (`StageView`, which takes the bias off the
 * texel depth before the projection) both compute it in metres, so it does not follow the camera's range. Above the depth
 * buffer's step at the farthest figure; below any distance a scene means (a millimetre a place; 20 figures, 2 cm).
 */
export const TIE_BIAS = 0.001

/**
 * The depth of every texel of a sprite's cell along the camera's `fwd`, in metres: `Infinity` where the cell is empty. A
 * texel's surface point is `(x, y', depth)` in the cell's frame (x to the screen's right, y' up the cell, `Cell.depth` toward
 * the camera, along the pitch the cell was painted at), turned to the world by Ry(azimuth) (docs/contract.md: world =
 * Ry(azimuth) · cell) and put at the sprite's `at`: its depth along `fwd` is the root's (`sprite.depth`) plus the turned
 * offset's component along `fwd`. Under a camera at the cell's own pitch that is the root's less the cell's depth. This is the
 * per-texel depth the scene tests with, on the GPU and in `compose`, as 32-bit floats.
 */
export function texelDepths(camera: CameraPose, sprite: StageSprite): Float32Array {
  const { cell, at } = sprite,
    [w, h] = cell.size,
    out = new Float32Array(w * h)
  const az = viewOf(camera, at).azimuth,
    ca = Math.cos(az),
    sa = Math.sin(az),
    cp = Math.cos(cell.pitch),
    sp = Math.sin(cell.pitch)
  const [fx, fy, fz] = camera.fwd,
    m = cell.metresPerTexel
  for (let v = 0; v < h; v++) {
    const up = (cell.anchor[1] - (v + 0.5)) * m
    for (let u = 0; u < w; u++) {
      const k = v * w + u
      if (!cell.rgba[k * 4 + 3]) {
        out[k] = Infinity
        continue
      }
      const x = (u + 0.5 - w / 2) * m,
        y = up * cp + cell.depth[k] * sp,
        z = -up * sp + cell.depth[k] * cp
      out[k] = sprite.depth + (x * ca + z * sa) * fx + y * fy + (-x * sa + z * ca) * fz
    }
  }
  return out
}

/**
 * The CPU reference: an RGBA frame of `camera.size`, transparent where empty, each sprite blitted nearest-neighbour at
 * its `scale` with its top-left at `screen`, depth-tested texel by texel (`texelDepths`), as the GPU does it. It goes by
 * pixel centres, the GPU's rule: a pixel takes texel `(floor((px + 0.5 − x) / scale), floor((py + 0.5 − y) / scale))`
 * when that texel is in the cell and its alpha is set. The sprites go in the frame's order (far to near by root); a texel
 * replaces what is there when its test depth, its depth less `(rank + 1) · TIE_BIAS`, is nearer, so equal depths fall to the
 * later sprite and a figure wins a tie with the `backdrop`, the scene's own geometry, which is tested the same way. A sprite
 * off the frame writes nothing.
 */
export function compose(frame: StageFrame, backdrop?: Backdrop): Uint8ClampedArray {
  const [W, H] = frame.camera.size,
    out = new Uint8ClampedArray(W * H * 4),
    z = new Float32Array(W * H).fill(Infinity)
  if (backdrop)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const b = backdrop(x + 0.5, y + 0.5)
        if (b) {
          out.set(b.rgba, (y * W + x) * 4)
          z[y * W + x] = b.depth
        }
      }
  frame.sprites.forEach((sprite, rank) => {
    const bias = (rank + 1) * TIE_BIAS,
      {
        cell,
        screen: [sx, sy],
        scale: k,
      } = sprite,
      [w, h] = cell.size,
      px = cell.rgba,
      depths = texelDepths(frame.camera, sprite)
    const x0 = Math.max(0, Math.floor(sx - 0.5)),
      x1 = Math.min(W, Math.ceil(sx + k * w + 0.5))
    const y0 = Math.max(0, Math.floor(sy - 0.5)),
      y1 = Math.min(H, Math.ceil(sy + k * h + 0.5))
    for (let y = y0; y < y1; y++) {
      const v = Math.floor((y + 0.5 - sy) / k)
      if (v < 0 || v >= h) continue
      for (let x = x0; x < x1; x++) {
        const u = Math.floor((x + 0.5 - sx) / k)
        if (u < 0 || u >= w) continue
        const i = v * w + u
        const test = Math.fround(depths[i] - bias) // as the GPU holds it, a 32-bit float
        if (px[i * 4 + 3] && test < z[y * W + x]) {
          out.set(px.subarray(i * 4, i * 4 + 4), (y * W + x) * 4)
          z[y * W + x] = test
        }
      }
    }
  })
  return out
}
