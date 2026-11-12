import type { Figure } from '../figure/figure'
import type { Weave } from '../paint/fabric'

/**
 * The cell: a painted figure as a scene draws it. The first piece of the stage's contract (docs/contract.md): plain
 * data over a `Figure`'s own buffers, with no Pixi and no DOM, so any host (the Pixi 3D view here, a scene
 * renderer, the framework's billboard) draws the same painted texels.
 */

/** A painted figure as a scene draws it. Every buffer is the figure's own, valid until its next draw. */
export interface Cell {
  /** The colour's key, `<w>x<h>:<hash of rgba>`: it changes whenever `rgba` may have, so it keys a texture of the colours
   * (the view's upload). It does not cover `painted`, `normals`, `depth` or `weave`: a consumer that caches one of those reads
   * it fresh each frame, or keys it by its own hash. */
  key: string
  size: [w: number, h: number]
  /** RGBA, alpha 0 or 255 only, an empty texel 0,0,0,0: the painter's cell, or the lit cell when the stage lit it. */
  rgba: Uint8ClampedArray
  /** The unlit painted cell (the same buffer as `rgba` when the stage did not light it). */
  painted: Uint8ClampedArray
  /** The normal map (lightFigure's LitSource.normals): view space, alpha 0 where none. */
  normals: Uint8ClampedArray
  /** Metres toward the camera from the root's plane, per texel (`Figure.depth`: the G-buffer's depth, the nearest neighbour's
   * under an outline texel); finite wherever rgba's alpha is set, −Infinity elsewhere. Always present, fresh or from the cell
   * cache: the scene's per-texel depth test reads it. */
  depth: Float32Array
  /** The fabric data (H5), or null: what a GPU light needs to light a tiled cloth's ground and lay the tile after. */
  weave: Weave | null
  /** The texel the figure's root on the ground maps to: [w / 2, h − feet]. */
  anchor: [x: number, y: number]
  /** Metres one texel covers, the density, the direction drawn (0–7) and the pitch drawn at (rad). */
  metresPerTexel: number
  density: number
  direction: number
  pitch: number
}

/** A 32-bit FNV-1a hash of the bytes, in base 36. */
function fnv(bytes: Uint8ClampedArray): string {
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193)
  return (h >>> 0).toString(36)
}

/**
 * The cell of a `Figure` after its `update` (or an actor's `draw`); `lit` is that figure's cell as `lightFigure`
 * returned it. It copies nothing, and clears the colour under alpha 0 in place (as `ScriptedActor.draw` does), so an
 * empty texel is 0,0,0,0 whoever drew the figure. `key` hashes the colour (`rgba`), so it differs whenever the colours do.
 */
export function cellOf(figure: Figure, lit?: Uint8ClampedArray): Cell {
  const px = figure.painted
  for (let i = 3; i < px.length; i += 4) if (!px[i]) px[i - 3] = px[i - 2] = px[i - 1] = 0
  const [w, h] = figure.cell,
    rgba = lit ?? px
  return {
    key: `${w}x${h}:${fnv(rgba)}`,
    size: [w, h],
    rgba,
    painted: px,
    normals: figure.normals,
    depth: figure.depth,
    weave: figure.weave,
    anchor: [w / 2, h - figure.feet],
    metresPerTexel: figure.metres / h,
    density: h / 96,
    direction: ((Math.round(figure.relativeYaw / (Math.PI / 4)) % 8) + 8) % 8,
    pitch: figure.pitch,
  }
}
