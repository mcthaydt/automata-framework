// `figure(def, options)`: a procedural character as an entity view (M3 spec §4.1, §4.4.1). It builds the figure's
// parts once (`build`), draws them (figure-meshes.ts) and poses them from presentation time: the gait's pose clock
// and what the sim says through the render row (moving, the direction of travel, the outfit and the held item). The
// pose is evaluated only when the pose clock steps or that state changes, so a figure costs nothing between pose
// steps but its light tint. Motion never feeds back into the sim (law 1).
//
// M3.6d replaces the driver here (`evaluateMotion` on a `MotionState`) with `evaluate()` on the full `FigureState`
// (clips, stances, aim); the drawing stays.
import { DEFAULT_PALETTE } from '@mcthaydt/automata-content'
import {
  type Built,
  build,
  evaluateMotion,
  type FigureDef,
  type FigureLibrary,
  type Gait,
  gaitOf,
  poseClock,
  skeleton,
} from '@mcthaydt/automata-figures'
import type { FieldRecord } from '@mcthaydt/automata-sim'
import { Container3D } from '@pixi/3d'
import { channels } from '../light/vertex-light.js'
import { tinted } from '../views/box-view.js'
import { placeView3d } from '../views/pose-3d.js'
import type { View3dFactory } from '../views/view-3d.js'
import { drawFigure, type FigureDrawing } from './figure-meshes.js'

/**
 * Building a figure's meshes past this many milliseconds logs a warning. S7-Q9 measured the one-off build at 1.95 ms
 * p95 in Node (docs/spikes/s7-pixi3d.md); this leaves room for a phone until M3.1b's phone numbers set it.
 */
export const FIGURE_BUILD_BUDGET_MS = 5

/** What the view reads from the sim each frame. */
export interface FigureViewState {
  readonly moving: boolean
  /** Walking, the direction of travel against the facing (rad): 0 forward, ±π/2 a strafe, π backing away. */
  readonly moveDir?: number | undefined
  /** An outfit of the figure's; its default when left out. */
  readonly outfit?: string | undefined
  /** An item id from the items library, or none. */
  readonly item?: string | null | undefined
}

type Components = Readonly<Record<string, Readonly<FieldRecord>>>

export interface FigureViewOptions {
  /** The figure libraries, as compiled content holds them. */
  readonly library: FigureLibrary
  /** The gaits library: the figure's `gait` names one. */
  readonly gaits: Readonly<Record<string, Gait>>
  /** Reads the figure's state from its render row's components; standing in its default outfit when left out. */
  readonly state?: ((components: Components) => FigureViewState) | undefined
  /** The palette materials index, as `#rrggbb` strings (Endesga 64 by default). */
  readonly palette?: readonly string[] | undefined
  /** Presentation time in seconds (the frame clock). */
  readonly now?: (() => number) | undefined
  /** The build timer in milliseconds. */
  readonly measure?: (() => number) | undefined
  /** Where a slow build is reported. */
  readonly warn?: ((message: string) => void) | undefined
}

const STANDING: FigureViewState = { moving: false }

/**
 * A figure standing on its component's position (its feet at `y`), interpolated between ticks and turned by `yaw`:
 * `views: { [Hero.id]: figure(wick, { library, gaits, state: (c) => ({ moving: c.hero?.speed !== 0 }) }) }`.
 */
export function figure(def: FigureDef, options: FigureViewOptions): View3dFactory {
  const rig = skeleton(def)
  const gait = gaitOf(def, options.gaits)
  const palette = options.palette ?? DEFAULT_PALETTE.colors
  const now = options.now ?? (() => performance.now() / 1000)
  const measure = options.measure ?? (() => performance.now())
  const warn = options.warn ?? ((message: string) => console.warn(message))
  const stateOf = options.state ?? (() => STANDING)
  let warned = false

  return (row, componentId, _models, light) => {
    const container = new Container3D()
    const lit: [number, number, number] = [0, 0, 0]
    let drawing: FigureDrawing
    let built: Built
    let dressed = ''
    let posed = ''

    const dress = (outfit: string, item: string | null) => {
      const started = measure()
      built = build(def, rig, outfit, item, options.library)
      const next = drawFigure(built, rig, palette, { lit: light !== undefined })
      const took = measure() - started
      if (took > FIGURE_BUILD_BUDGET_MS && !warned) {
        warned = true
        warn(
          `figure on ${componentId ?? 'an entity'} took ${Math.round(took)} ms to build (budget ${FIGURE_BUILD_BUDGET_MS} ms)`,
        )
      }
      drawing?.destroy()
      drawing = next
      container.addChild(drawing.node)
      dressed = `${outfit}|${item ?? ''}`
      posed = ''
    }

    const pose = (state: FigureViewState) => {
      const outfit = state.outfit ?? def.default
      const item = state.item ?? null
      if (`${outfit}|${item ?? ''}` !== dressed) dress(outfit, item)
      const clock = poseClock(gait, now())
      const key = `${clock.step}|${state.moving}|${state.moveDir ?? 0}`
      if (key === posed) return
      posed = key
      // At yaw 0: the node carries the facing, as every 3D view's does.
      const { world } = evaluateMotion(rig, gait, {
        t: clock.t,
        moving: state.moving,
        phase: clock.phase,
        yaw: 0,
        headYaw: 0,
        shuffle: 0,
        moveDir: state.moveDir,
        clear: built.clearance,
      })
      drawing.pose(world)
    }

    const tint = () => {
      if (light === undefined) return
      // Lit at the chest, where the light on a character reads (M3R-D4).
      const { x, y, z } = container.position
      light.tint(x, y + rig.chestY, z, undefined, lit)
      for (const { material, colour, flat } of drawing.materials.values())
        if (!flat) material.baseColor = tinted(channels(colour), lit)
    }

    placeView3d(container, row.components, undefined, 1, componentId)
    pose(stateOf(row.components))
    tint()
    return {
      container,
      update(curr, prev, alpha = 1) {
        placeView3d(container, curr, prev, alpha, componentId)
        pose(stateOf(curr))
        tint()
      },
      destroy() {
        drawing.destroy()
        container.destroy({ children: true })
      },
    }
  }
}
