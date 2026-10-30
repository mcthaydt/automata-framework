import { Container3D, CubeGeometry, FlatMaterial, Mesh3D, PhongMaterial } from '@pixi/3d'
import { channels, toSrgb } from '../light/vertex-light.js'
import { placeView3d } from './pose-3d.js'
import { shareMaterial } from './shared-material.js'
import type { View3dFactory } from './view-3d.js'

export interface BoxSize {
  /** Metres along x. */
  readonly width: number
  /** Metres along y. */
  readonly height: number
  /** Metres along z. */
  readonly depth: number
}

export interface BoxMaterial {
  /** Base colour, e.g. 0xf9c22b. */
  readonly color: number
  /**
   * Lit by the room's light when the renderer has `lighting` (without it, a plain box):
   * - `'static'`: scenery. Vertex light is baked into its own geometry once, at its first pose, with occlusion, and
   *   rebaked when a lamp reaching it changes (M3 spec §4.3). It must not move. Its faces are cut into 25 cm cells
   *   whether or not the renderer has `lighting`. Occluder boxes never skip it (there is no `ignore` here: bake a mesh
   *   with `SceneLight.bake(mesh, { ignore })` for that).
   * - `'moving'`: a character (M3R-D4). Each frame it takes the ambient light plus the lamps in range at its
   *   position, as its colour times that tint, on a flat material of its own.
   */
  readonly lit?: 'static' | 'moving' | undefined
}

/**
 * A base colour (in linear light) lit by the tint: each channel multiplied by the tint's, as the baked vertex
 * colours multiply a static mesh, then back to sRGB as 0xRRGGBB, capped at white.
 */
function tinted(linear: readonly [number, number, number], tint: readonly [number, number, number]): number {
  const channel = (c: 0 | 1 | 2) => Math.round(255 * Math.min(1, toSrgb(linear[c] * tint[c])))
  return (channel(0) << 16) | (channel(1) << 8) | channel(2)
}

/** Vertex light lands on vertices: a static box's faces are cut into cells no wider than this many metres. */
const BAKE_CELL = 0.25

/**
 * A box standing on its component's position (its base at `y`), interpolated between ticks and turned by `yaw`:
 * `views: { [Crate.id]: box({ width: 1, height: 1, depth: 1 }, { color: 0x9e4539 }) }`. The boxes of one factory
 * share their geometry and material, except that a moving lit box has a material of its own (`lit`).
 */
export function box(size: BoxSize, material: BoxMaterial): View3dFactory {
  const cells = (metres: number) =>
    material.lit === 'static' ? Math.max(1, Math.ceil(metres / BAKE_CELL)) : 1
  const geometry = new CubeGeometry({
    width: size.width,
    height: size.height,
    depth: size.depth,
    widthSegments: cells(size.width),
    heightSegments: cells(size.height),
    depthSegments: cells(size.depth),
  })
  // Shared between the view's boxes; the occluder rule gives a faded box its own copy (M3.4c).
  const shared = shareMaterial(
    new PhongMaterial({ baseColor: material.color }),
    () => new PhongMaterial({ baseColor: material.color }),
  )
  // Static boxes share one flat material: their light is in their own vertex colours.
  const baked =
    material.lit === 'static'
      ? shareMaterial(
          new FlatMaterial({ baseColor: material.color }),
          () => new FlatMaterial({ baseColor: material.color }),
        )
      : undefined
  // The base colour in linear light, decoded once for the per-frame tint.
  const linear = channels(material.color)
  return (row, componentId, _models, light) => {
    const node = new Container3D()
    // A moving lit box has a flat material of its own: its colour changes every frame.
    const tint = material.lit === 'moving' ? light : undefined
    // The tint is written here each frame, so a frame allocates nothing.
    const lit: [number, number, number] = [0, 0, 0]
    const own = tint === undefined ? undefined : new FlatMaterial({ baseColor: material.color })
    const bakes = light !== undefined && baked !== undefined
    const drawn = new Mesh3D({ geometry, material: own ?? (bakes ? baked : shared) })
    drawn.position.set(0, size.height / 2, 0)
    node.addChild(drawn)
    if (bakes) {
      placeView3d(node, row.components, undefined, 1, componentId)
      light.bake(drawn)
    }
    return {
      container: node,
      update(curr, prev, alpha = 1) {
        placeView3d(node, curr, prev, alpha, componentId)
        if (tint === undefined || own === undefined) return
        // Lit at its middle, where the light on a character reads.
        const { x, y, z } = node.position
        own.baseColor = tinted(linear, tint.tint(x, y + size.height / 2, z, undefined, lit))
      },
      destroy() {
        node.destroy({ children: true })
        if (bakes) light?.release(drawn)
        own?.destroy()
      },
    }
  }
}
