import { Container3D, CubeGeometry, Mesh3D, PhongMaterial } from '@pixi/3d'
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
}

/**
 * A lit box standing on its component's position (its base at `y`), interpolated between ticks and turned by
 * `yaw`: `views: { [Crate.id]: box({ width: 1, height: 1, depth: 1 }, { color: 0x9e4539 }) }`. The boxes of one
 * factory share their geometry and material.
 */
export function box(size: BoxSize, material: BoxMaterial): View3dFactory {
  const geometry = new CubeGeometry({ width: size.width, height: size.height, depth: size.depth })
  const shared = new PhongMaterial({ baseColor: material.color })
  return (_row, componentId) => {
    const node = new Container3D()
    const drawn = new Mesh3D({ geometry, material: shared })
    drawn.position.set(0, size.height / 2, 0)
    node.addChild(drawn)
    return {
      container: node,
      update(curr, prev, alpha = 1) {
        placeView3d(node, curr, prev, alpha, componentId)
      },
      destroy() {
        node.destroy({ children: true })
      },
    }
  }
}
