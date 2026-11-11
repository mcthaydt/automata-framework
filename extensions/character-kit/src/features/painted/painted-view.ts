// A painted figure as an entity's view in the 3D renderer: the builder paints its cell and a quad shows it
// (figure-sprite.ts), standing where the entity stands and turned the way it faces, seen from the renderer's camera.
import { placeView3d, type View3dFactory } from '@automata/3d'
import { Container3D } from '@pixi/3d'
import { type CharacterDef, member } from '../../shared/figure-builder/door.ts'
import { eyeOf } from './camera.ts'
import { FigureSprite } from './figure-sprite.ts'

/** An entity's components, as the renderer hands them to a view. */
type Components = Parameters<typeof placeView3d>[1]

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

/**
 * A painted figure for `views` in `createPixi3dRenderer`: `views: { [Hero.id]: paintedFigure(BASE[0].def) }`. The
 * entity's component holds its pose (`x`, `y`, `z`, `yaw`); a renderer that hands its views no camera draws nothing.
 */
export function paintedFigure(def: CharacterDef, options: PaintedFigureOptions = {}): View3dFactory {
  const now = options.now ?? (() => performance.now() / 1000)
  const stateOf = options.state ?? (() => STANDING)
  const density = options.density ?? 2
  return (row, componentId, _models, _light, camera) => {
    if (camera === undefined) return undefined
    const node = new Container3D(),
      fig = new FigureSprite(member(def, density))
    node.addChild(fig.sprite)
    let last = now()
    const show = (components: Components, prev: Components | undefined, alpha: number) => {
      placeView3d(node, components, prev, alpha, componentId)
      // The node carries the position and the quad turns itself to the camera, so the node keeps no turn of its own. An
      // entity's yaw 0 faces −z and a figure's facing 0 faces +z: half a turn between them.
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
