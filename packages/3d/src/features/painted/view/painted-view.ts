// A painted figure as an entity's view in the 3D renderer: the figure's painter draws its cell and a quad in the scene
// shows it (figure-sprite.ts), standing where the entity stands and turned the way it faces, seen from the renderer's
// camera. The look is the painter's alone: nothing here shades, snaps or outlines.

import type { FieldRecord } from '@automata/sim'
import { type Camera3D, Container3D } from '@pixi/3d'
import { placeView3d } from '../../../shared/render/views/pose-3d.ts'
import type { View3dFactory } from '../../../shared/render/views/view-3d.ts'
import { type CharacterDef, memberOf } from '../figure/cast.ts'
import type { V3 } from '../lib/math.ts'
import { FigureSprite } from './figure-sprite.ts'

type Components = Readonly<Record<string, Readonly<FieldRecord>>>

/** What a painted figure is doing this frame. */
export interface PaintedState {
  readonly moving: boolean
}

export interface PaintedFigureOptions {
  /** Texels per texel of the base cell: 1 is 64 × 96, 2 is 128 × 192 (the default) and so on. */
  readonly density?: number | undefined
  /** The figure's state from the entity's components; standing by default. */
  readonly state?: ((components: Components) => PaintedState) | undefined
  /** Seconds, for the figure's pose clock; the page's clock by default. */
  readonly now?: (() => number) | undefined
}

const STANDING: PaintedState = { moving: false }

/** Where the camera stands and the point it looks at: its position, and one metre along its view (its local −z). */
function eyeOf(camera: Camera3D): { eye: V3; target: V3 } {
  const { x, y, z, w } = camera.quaternion,
    p = camera.position
  // −z turned by the camera's rotation.
  const fx = -2 * (x * z + w * y),
    fy = -2 * (y * z - w * x),
    fz = -(1 - 2 * (x * x + y * y))
  return { eye: [p.x, p.y, p.z], target: [p.x + fx, p.y + fy, p.z + fz] }
}

/**
 * A painted figure for `views` in `createPixi3dRenderer`: `views: { [Hero.id]: paintedFigure(BASE[0].def) }`. The entity's
 * component holds its pose (`x`, `y`, `z`, `yaw`); a renderer that hands its views no camera draws nothing.
 */
export function paintedFigure(def: CharacterDef, options: PaintedFigureOptions = {}): View3dFactory {
  const now = options.now ?? (() => performance.now() / 1000)
  const stateOf = options.state ?? (() => STANDING)
  const density = options.density ?? 2
  return (row, componentId, _models, _light, camera) => {
    if (camera === undefined) return undefined
    const node = new Container3D(),
      fig = new FigureSprite(memberOf(def, density))
    node.addChild(fig.sprite)
    let last = now()
    const show = (components: Components, prev: Components | undefined, alpha: number) => {
      placeView3d(node, components, prev, alpha, componentId)
      // The node carries the position; the quad turns itself to the camera, so the node keeps no turn of its own. An
      // entity's yaw 0 faces −z, and a figure's facing 0 faces +z: half a turn between them.
      const yaw = node.rotation.y
      node.rotation.set(0, 0, 0)
      const t = now(),
        p = node.position
      fig.update(Math.max(0, t - last), {
        facing: yaw + Math.PI,
        moving: stateOf(components).moving,
        at: [p.x, p.y, p.z],
        ...eyeOf(camera),
      })
      last = t
    }
    show(row.components, undefined, 1)
    return {
      container: node,
      update(curr, prev, alpha = 1) {
        show(curr, prev, alpha)
      },
      destroy() {
        fig.destroy()
        node.destroy({ children: true })
      },
    }
  }
}
