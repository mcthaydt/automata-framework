import { Container3D, CubeGeometry, FlatMaterial, Mesh3D, PhongMaterial } from '@pixi/3d'
import { placeView3d } from './pose-3d.js'
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
   *   rebaked when a lamp reaching it changes (M3 spec §4.3). It must not move.
   * - `'moving'`: a character (M3R-D4). Each frame it takes the ambient light plus the lamps in range at its
   *   position, as its colour times that tint, on a flat material of its own.
   */
  readonly lit?: 'static' | 'moving' | undefined
}

/** `colour` (0xRRGGBB) with each channel multiplied by the tint's, capped at 255. */
function tinted(colour: number, tint: readonly [number, number, number]): number {
  const channel = (shift: number, k: number) => Math.min(255, Math.round(((colour >> shift) & 255) * k))
  return (channel(16, tint[0]) << 16) | (channel(8, tint[1]) << 8) | channel(0, tint[2])
}

/**
 * A box standing on its component's position (its base at `y`), interpolated between ticks and turned by `yaw`:
 * `views: { [Crate.id]: box({ width: 1, height: 1, depth: 1 }, { color: 0x9e4539 }) }`. The boxes of one factory
 * share their geometry and material, except that a lit box has its own (`lit`).
 */
export function box(size: BoxSize, material: BoxMaterial): View3dFactory {
  const geometry = new CubeGeometry({ width: size.width, height: size.height, depth: size.depth })
  const shared = new PhongMaterial({ baseColor: material.color })
  // Static boxes share one flat material: their light is in their vertex colours.
  const baked = material.lit === 'static' ? new FlatMaterial({ baseColor: material.color }) : undefined
  return (row, componentId, _models, light) => {
    const node = new Container3D()
    const tint = material.lit === 'moving' ? light : undefined
    const own = tint === undefined ? undefined : new FlatMaterial({ baseColor: material.color })
    const drawn = new Mesh3D({
      geometry,
      material: own ?? (light === undefined ? undefined : baked) ?? shared,
    })
    drawn.position.set(0, size.height / 2, 0)
    node.addChild(drawn)
    if (light !== undefined && baked !== undefined) {
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
        own.baseColor = tinted(material.color, tint.tint(x, y + size.height / 2, z))
      },
      destroy() {
        if (baked !== undefined) light?.release(drawn)
        node.destroy({ children: true })
        own?.destroy()
      },
    }
  }
}
