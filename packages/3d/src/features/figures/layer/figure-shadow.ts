// A figure's shadow on the floor: a contact ellipse under its feet, and its silhouette thrown along the key light onto
// the ground. It is a floor quad with a mask for its alpha, blended black over the floor under it: black at alpha
// `1 - figureShadow` multiplies what is under it by `figureShadow`. The blend leaves the floor's own alpha (1, a world
// pixel), so the snap that follows dithers the shadowed floor like any other, and no code under it is lost.

import { FlatMaterial, Geometry3D, Mesh3D } from '@pixi/3d'
import type { Texture } from 'pixi.js'
import type { PaintedCell } from '../paint/paint-cell.ts'
import { CELL_METRES } from '../paint/soup.ts'
import { cellTexture } from './cell-composite-pass.ts'

type V3 = readonly [number, number, number]

/** The square of floor a shadow can fall on, in metres, and the mask's texels along its side. */
export const SHADOW_SIDE = 6
export const SHADOW_TEXELS = 96

/** The contact ellipse: 0.3 m across and 0.16 m deep, under the feet. */
const ACROSS = 0.3
const DEEP = 0.16
/** A texel counts as the figure's from this alpha up, as the sprite light counts it. */
const OPAQUE = 128

/** How the camera sees the figure: where its right lies on the floor (a unit vector in x, z) and its pitch down. */
export interface ShadowFrame {
  readonly right: readonly [number, number]
  readonly pitch: number
}

/**
 * The shadow's mask, `SHADOW_TEXELS` squared, 255 where the floor is shadowed: the contact ellipse, and with a `key` (the
 * direction toward the light, unit, world) the cell's silhouette thrown onto the floor along it. The figure stands in
 * the middle of the mask, facing the camera: a texel of the cell is `u` metres to the right of the feet and `h` metres
 * above them (foreshortened by the pitch), and its shadow lies `h` along the key's floor part from where `u` is.
 */
export function shadowMask(
  cell: PaintedCell,
  frame: ShadowFrame,
  key: V3 | undefined,
  out: Uint8Array = new Uint8Array(SHADOW_TEXELS * SHADOW_TEXELS),
): Uint8Array {
  out.fill(0)
  const step = SHADOW_SIDE / SHADOW_TEXELS
  const mid = SHADOW_TEXELS / 2
  const [rx, rz] = frame.right
  // Forward on the floor, away from the camera, a quarter turn from right.
  const fx = rz
  const fz = -rx
  const mark = (dx: number, dz: number): void => {
    const i = Math.floor(dx / step + mid)
    const j = Math.floor(dz / step + mid)
    if (i >= 0 && j >= 0 && i < SHADOW_TEXELS && j < SHADOW_TEXELS) out[j * SHADOW_TEXELS + i] = 255
  }
  for (let j = 0; j < SHADOW_TEXELS; j++)
    for (let i = 0; i < SHADOW_TEXELS; i++) {
      const dx = (i + 0.5 - mid) * step
      const dz = (j + 0.5 - mid) * step
      const a = (dx * rx + dz * rz) / ACROSS
      const b = (dx * fx + dz * fz) / DEEP
      if (a * a + b * b <= 1) out[j * SHADOW_TEXELS + i] = 255
    }
  if (key === undefined || key[1] < 0.2) return out
  const ppm = cell.height / CELL_METRES
  const cp = Math.cos(frame.pitch)
  const ax = -key[0] / key[1]
  const az = -key[2] / key[1]
  const { width, height, colours, feet } = cell
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if ((colours[(y * width + x) * 4 + 3] ?? 0) < OPAQUE) continue
      const u = (x + 0.5 - feet[0]) / ppm
      const h = Math.max(0, (feet[1] - y) / (ppm * cp))
      mark(u * rx + h * ax, u * rz + h * az)
    }
  return out
}

/** A floor quad for a shadow, `SHADOW_SIDE` across, the mask as its alpha. */
export interface FigureShadow {
  readonly mesh: Mesh3D
  /** Stands the shadow at `root` (the feet, in the world) and draws `cell`'s shadow for this view of it. */
  update(cell: PaintedCell, root: V3, key: V3 | undefined, frame: ShadowFrame): void
  destroy(): void
}

/** A shadow darkening what it falls on to `strength` (0 to 1) of its colour. */
export function createFigureShadow(strength: number): FigureShadow {
  const half = SHADOW_SIDE / 2
  const geometry = new Geometry3D({
    positions: new Float32Array([-half, 0, -half, half, 0, -half, half, 0, half, -half, 0, half]),
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint16Array([0, 2, 1, 0, 3, 2]),
  })
  const rgba = new Uint8Array(SHADOW_TEXELS * SHADOW_TEXELS * 4)
  const texture: Texture = cellTexture(rgba, SHADOW_TEXELS, SHADOW_TEXELS)
  const mesh = new Mesh3D({
    geometry,
    material: new FlatMaterial({ baseColor: 0x000000, baseColorTexture: texture, alphaMode: 'blend' }),
  })
  const alpha = Math.round((1 - strength) * 255)
  const mask = new Uint8Array(SHADOW_TEXELS * SHADOW_TEXELS)
  return {
    mesh,
    update(cell, root, key, frame) {
      shadowMask(cell, frame, key, mask)
      for (let k = 0; k < mask.length; k++) rgba[k * 4 + 3] = mask[k] ? alpha : 0
      texture.source.update()
      // A hair above the floor, so the two never fight over a pixel.
      mesh.position.set(root[0], root[1] + 0.01, root[2])
    },
    destroy() {
      mesh.destroy({ children: true })
      texture.destroy(true)
    },
  }
}
