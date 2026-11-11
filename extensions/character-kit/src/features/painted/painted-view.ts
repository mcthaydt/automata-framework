// A painted figure as an entity's view in the 3D renderer: the builder paints its cell for the camera's view, and the camera's
// painted stage (painted-stage.ts) places it by the stage contract and draws it with per-texel depth, standing where the
// entity stands and turned the way it faces. The entity owns the figure's place and facing (the sim decides them); the
// painter only draws them.
import { placeView3d, type View3dFactory } from '@automata/3d'
import { Container3D } from '@pixi/3d'
import type { CharacterDef, V3 } from '../../shared/figure-builder/door.ts'
import { type PaintedStage, type StageMember, stageFor } from './painted-stage.ts'
import { Painter } from './painter.ts'
import { checkState, type PaintedState } from './state.ts'

export type { PaintedState } from './state.ts'

/** An entity's components, as the renderer hands them to a view. */
type Components = Parameters<typeof placeView3d>[1]

export interface PaintedFigureOptions {
  /** Texels per texel of the base cell: 1 is 64 × 96, 2 is 128 × 192 (the default, the builder's working resolution) and 4. */
  readonly density?: 1 | 2 | 4 | undefined
  /** The figure's state from the entity's components; standing by default. */
  readonly state?: ((components: Components) => PaintedState) | undefined
  /** Seconds, for the figure's pose clock; the page's clock by default. */
  readonly now?: (() => number) | undefined
}

const STANDING: PaintedState = { moving: false }

/**
 * A painted figure for `views` in `createPixi3dRenderer`: `views: { [Hero.id]: paintedFigure(BASE[0].def) }`. The
 * entity's component holds its pose (`x`, `y`, `z`, `yaw`); a renderer that hands its views no camera draws nothing.
 * `state` may name one of the builder's stands (`pose`) and one of the character's outfits (`outfit`): a name that does not
 * exist throws, in words, the first time the entity is drawn.
 */
export function paintedFigure(def: CharacterDef, options: PaintedFigureOptions = {}): View3dFactory {
  const now = options.now ?? (() => performance.now() / 1000)
  const stateOf = options.state ?? (() => STANDING)
  const density = options.density ?? 2
  return (row, componentId, _models, _light, camera) => {
    if (camera === undefined) return undefined
    const stage: PaintedStage = stageFor(camera)
    const node = new Container3D()
    const painter = new Painter(def, density)
    let facing = Math.PI
    let state = STANDING
    let last = now()
    let onStage: { remove(): void } | undefined
    const figure: StageMember = {
      node,
      frame(view) {
        const t = now()
        const at: V3 = [node.position.x, node.position.y, node.position.z]
        const cell = painter.paint({ t, dt: Math.max(0, t - last), facing, state, view: view(at) })
        last = t
        return { cell, at, name: def.id }
      },
    }
    const show = (components: Components, prev: Components | undefined, alpha: number) => {
      placeView3d(node, components, prev, alpha, componentId)
      // An entity's yaw 0 faces −z and a figure's facing 0 faces +z: half a turn between them. The node keeps no turn of its
      // own: the quad is turned to the camera by the stage.
      facing = node.rotation.y + Math.PI
      node.rotation.set(0, 0, 0)
      state = stateOf(components)
      checkState(def, state)
    }
    show(row.components, undefined, 1)
    return {
      container: node,
      update(curr, prev, alpha = 1) {
        show(curr, prev, alpha)
        // The node is in the scene by the first update, and only then does it name the view the stage hooks.
        if (onStage === undefined && node.view3d !== null) onStage = stage.add(figure)
      },
      destroy() {
        onStage?.remove()
        node.destroy({ children: true })
      },
    }
  }
}
