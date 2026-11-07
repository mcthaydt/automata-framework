import type { RenderRow } from '@automata/sim'
import { Container3D, Mesh3D } from '@pixi/3d'
import type { ModelLibrary } from '../model/load-models.ts'
import { placeView3d } from './pose-3d.ts'
import type { EntityView3d, View3dFactory } from './view-3d.ts'

export interface MeshViewOptions {
  /** Scales the model so it stands this many metres tall. Default: the file's own size. */
  readonly height?: number | undefined
}

/**
 * A static model from a `.glb` or packed `.bin` file, standing on its component's position (the model's lowest
 * point at `y`), interpolated between ticks and turned by `yaw`. The renderer loads `file` from the game's preload
 * before the first frame; a skinned or malformed file fails boot with `ModelInvalid` (M3 spec §6).
 */
export function mesh(file: string, options: MeshViewOptions = {}): View3dFactory {
  const factory = (_row: RenderRow, componentId: string | undefined, models: ModelLibrary): EntityView3d => {
    const model = models.get(file)
    if (model === undefined) throw new Error(`mesh: "${file}" was not loaded before its view was built`)
    const [minY, maxY] = [model.mesh.min[1], model.mesh.max[1]]
    const scale = options.height === undefined || maxY === minY ? 1 : options.height / (maxY - minY)
    const node = new Container3D()
    const drawn = new Mesh3D({ geometry: model.geometry, material: model.material })
    drawn.scale.set(scale, scale, scale)
    drawn.position.set(0, -minY * scale, 0)
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
  return Object.assign(factory, { models: [file] as const })
}
