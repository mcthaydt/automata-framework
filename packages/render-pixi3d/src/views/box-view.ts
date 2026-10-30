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
   * Lit as a character by the room's light (M3R-D4): when the renderer has `lighting`, the box takes ambient plus
   * the lamps in range at its position every frame, as its colour times that tint, on a flat material of its own.
   * Without `lighting` it is a plain box.
   */
  readonly lit?: boolean | undefined
}

/** `colour` (0xRRGGBB) with each channel multiplied by the tint's, capped at 255. */
function tinted(colour: number, tint: readonly [number, number, number]): number {
  const channel = (shift: number, k: number) => Math.min(255, Math.round(((colour >> shift) & 255) * k))
  return (channel(16, tint[0]) << 16) | (channel(8, tint[1]) << 8) | channel(0, tint[2])
}

/**
 * A box standing on its component's position (its base at `y`), interpolated between ticks and turned by `yaw`:
 * `views: { [Crate.id]: box({ width: 1, height: 1, depth: 1 }, { color: 0x9e4539 }) }`. The boxes of one factory
 * share their geometry, and their material unless they are `lit`.
 */
export function box(size: BoxSize, material: BoxMaterial): View3dFactory {
  const geometry = new CubeGeometry({ width: size.width, height: size.height, depth: size.depth })
  const shared = new PhongMaterial({ baseColor: material.color })
  return (_row, componentId, _models, light) => {
    const node = new Container3D()
    const tint = material.lit === true ? light : undefined
    const own = tint === undefined ? undefined : new FlatMaterial({ baseColor: material.color })
    const drawn = new Mesh3D({ geometry, material: own ?? shared })
    drawn.position.set(0, size.height / 2, 0)
    node.addChild(drawn)
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
        node.destroy({ children: true })
        own?.destroy()
      },
    }
  }
}
