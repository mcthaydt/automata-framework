// `figure(def, options)`: a procedural character as an entity view (M3 spec §4.1, §4.4.1, §4.4.5). It builds the
// figure's parts once (`build`), draws them (figure-meshes.ts) and poses them from presentation time with figures'
// `evaluate()`: the gait's pose clock and what the sim says through the render row (moving, speed, the direction of
// travel, the action and stances, aim points, the outfit and the held item). The pose is evaluated only when the
// pose clock steps or that state changes (an aim point in the frame's own space changes as the figure moves, so a
// locked figure re-solves every frame, as §4.4.5 asks), so a figure costs nothing between pose steps but its light
// tint. The view owns what lives between frames: the hair spring, the last evaluated time (`previous`, so a clip's
// marker is not skipped) and the set of missing clips already warned about. Motion never feeds back into the sim
// (law 1).
import { DEFAULT_PALETTE } from '@automata/content/palette'
import {
  type AimTarget,
  type Built,
  build,
  evaluate,
  type FigureDef,
  type FigureLibrary,
  type FigureState,
  gaitOf,
  HAIR_AT_REST,
  type HairSpring,
  hairOf,
  hairStep,
  headNod,
  J,
  type M,
  type MotionLibrary,
  poseClock,
  skeleton,
  wrapAngle,
} from '@automata/figures'
import type { FieldRecord } from '@automata/sim'
import { Container3D } from '@pixi/3d'
import { channels } from '../light/vertex-light.js'
import { tinted } from '../views/box-view.js'
import { placeView3d } from '../views/pose-3d.js'
import type { View3dFactory } from '../views/view-3d.js'
import { drawFigure, type FigureDrawing } from './figure-meshes.js'

/**
 * Building a figure's meshes past this many milliseconds logs a warning. S7-Q9 measured the one-off build at 1.95 ms
 * p95 in Node (docs/archive/spikes/s7-pixi3d.md); this leaves room for a phone until M3.1b's phone numbers set it.
 */
export const FIGURE_BUILD_BUDGET_MS = 5

/**
 * What the view reads from the sim each frame: figures' `FigureState` (M3 spec §4.4.5) without what the view supplies
 * itself. The facing is the node's yaw (the render row's), the hair swing is the view's spring, and aim points are
 * world metres, which the view turns into the figure's own frame.
 */
export interface FigureViewState extends Omit<FigureState, 'facing' | 'speed' | 'hair' | 'item'> {
  /** Walking speed (m/s); the gait's tuned speed when left out. */
  readonly speed?: number | undefined
  /** An item id from the items library, or none. */
  readonly item?: string | null | undefined
}

type Components = Readonly<Record<string, Readonly<FieldRecord>>>

export interface FigureViewOptions {
  /** The figure libraries, as compiled content holds them. */
  readonly library: FigureLibrary
  /** The motion libraries (gaits, poses, clips, items, stands, rig limits), as compiled content holds them. */
  readonly motion: MotionLibrary
  /** Reads the figure's state from its render row's components; standing in its default outfit when left out. */
  readonly state?: ((components: Components) => FigureViewState) | undefined
  /** The palette materials index, as `#rrggbb` strings (Endesga 64 by default). */
  readonly palette?: readonly string[] | undefined
  /** Presentation time in seconds (the frame clock). */
  readonly now?: (() => number) | undefined
  /** The build timer in milliseconds. */
  readonly measure?: (() => number) | undefined
  /** Where a slow build, and a clip the sim names that no content has, are reported. */
  readonly warn?: ((message: string) => void) | undefined
}

const STANDING: FigureViewState = { moving: false }

/** `at` (world metres) in the frame of a node at `x`, `y`, `z` turned by `yaw` about +y. */
function toFigure(
  at: readonly number[],
  x: number,
  y: number,
  z: number,
  yaw: number,
): [number, number, number] {
  const dx = (at[0] ?? 0) - x
  const dz = (at[2] ?? 0) - z
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  return [dx * cos - dz * sin, (at[1] ?? 0) - y, dx * sin + dz * cos]
}

/**
 * A figure standing on its component's position (its feet at `y`), interpolated between ticks and turned by `yaw`:
 * `views: { [Hero.id]: figure(wick, { library, motion, state: (c) => ({ moving: c.hero?.speed !== 0 }) }) }`.
 */
export function figure(def: FigureDef, options: FigureViewOptions): View3dFactory {
  const rig = skeleton(def)
  const gait = gaitOf(def, options.motion.gaits)
  const hairDynamics = hairOf(def)
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
    // Between frames: the hair spring, the time and facing it was last stepped at, the head it hangs against, the
    // last evaluated time, and the missing clips already warned about.
    let hair: HairSpring = HAIR_AT_REST
    let hairAt: number | undefined
    let shownYaw = 0
    let head: M | undefined
    let previous: number | undefined
    const warnedClips = new Set<string>()

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
      const time = now()
      const clock = poseClock(gait, time)
      const { x, y, z } = container.position
      const yaw = container.rotation.y
      const aim: AimTarget[] | undefined = state.aim?.map((target) => ({
        ...target,
        at: toFigure(target.at, x, y, z, yaw),
      }))
      const speed = state.speed ?? gait.speed
      const key = JSON.stringify([
        clock.step,
        state.moving,
        speed,
        state.moveDir ?? 0,
        state.action,
        state.stances,
        aim,
      ])
      if (key === posed) return
      posed = key
      // The hair spring steps over the time since it last did, turning with the shown facing.
      const dt = hairAt === undefined ? 0 : Math.max(0, time - hairAt)
      if (dt > 0) {
        const input = {
          moving: state.moving,
          phase: clock.phase,
          speed,
          yawRate: wrapAngle(yaw - shownYaw) / dt,
          nod: head === undefined ? 0 : headNod(head, 0),
          headTilt: rig.genes.headTilt,
        }
        hair = hairStep(hairDynamics, hair, input, dt)
      }
      hairAt = time
      shownYaw = yaw
      // At facing 0: the node carries the facing, as every 3D view's does.
      const { world } = evaluate(
        rig,
        def,
        {
          ...state,
          speed,
          facing: 0,
          aim,
          item: item ?? undefined,
          hair: { pitch: hair.pitch, roll: hair.roll },
        },
        time,
        options.motion,
        { previous, warn, warned: warnedClips },
      )
      previous = time
      head = world[J.head]
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
