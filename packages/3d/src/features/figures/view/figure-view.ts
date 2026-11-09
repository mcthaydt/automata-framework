// `figure(def, options)`: a procedural character as an entity view. It builds the figure once (`build`), poses it from
// presentation time with figures' `evaluate()`: the gait's pose clock and what the sim says through the render row
// (moving, speed, the direction of travel, the action and stances, aim points, the outfit and the held item). The pose
// is evaluated only when the pose clock steps or that state changes (an aim point in the frame's own space changes as
// the figure moves, so a locked figure re-solves every frame). The figure is drawn as a painted cell by the renderer's
// figure layer: this view tells the layer where the figure stands and which way it faces, and paints the cell the layer
// asks for, from the pose it has. The view owns what lives between frames: the hair spring, the last evaluated time
// (`previous`, so a clip's marker is not skipped) and the set of missing clips already warned about. Motion never
// feeds back into the sim (law 1).
import type { FieldRecord } from '@automata/sim'
import { Container3D } from '@pixi/3d'
import type { M } from '../../../shared/math/math.ts'
import { placeView3d } from '../../../shared/render/views/pose-3d.ts'
import type { View3dFactory, ViewLayers3d } from '../../../shared/render/views/view-3d.ts'
import { J } from '../body/rig.ts'
import type { CellCache } from '../cells/cell-cache.ts'
import { cellKey } from '../cells/cell-key.ts'
import type { PaintQueue } from '../cells/paint-queue.ts'
import { evaluate } from '../clips/evaluate.ts'
import type { FigureState, MotionLibrary } from '../clips/figure-state.ts'
import { type Built, build, type FigureLibrary } from '../figure/build.ts'
import { type FigureDef, faceOf } from '../figure/figure.schema.ts'
import { skeleton } from '../figure/figure-skeleton.ts'
import type { FigureLayer, FoundCell, LayerFigure } from '../layer/figure-layer.ts'
import { poseClock, wrapAngle } from '../motion/clock.ts'
import { gaitOf, hairOf } from '../motion/gait-of.ts'
import { HAIR_AT_REST, type HairSpring, hairStep, headNod } from '../motion/hair-spring.ts'
import type { AimTarget } from '../motion/targets.ts'
import { paintPosed } from '../paint/paint-posed.ts'
import { STYLE } from '../paint/raster.ts'
import { type PaintFigure, paintFigure, soupOf } from '../paint/soup.ts'
import { spriteCheats } from '../paint/sprite-cheats.ts'

/**
 * Building a figure's meshes past this many milliseconds logs a warning. S7-Q9 measured the one-off build at 1.95 ms
 * p95 in Node (docs/archive/spikes/s7-pixi3d.md); this leaves room for a phone until a phone's measured numbers set it.
 */
export const FIGURE_BUILD_BUDGET_MS = 5

/**
 * What the view reads from the sim each frame: figures' `FigureState` without what the view supplies
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
  /** Presentation time in seconds (the frame clock). */
  readonly now?: (() => number) | undefined
  /** The build timer in milliseconds. */
  readonly measure?: (() => number) | undefined
  /** Where a slow build, and a clip the sim names that no content has, are reported. */
  readonly warn?: ((message: string) => void) | undefined
}

const STANDING: FigureViewState = { moving: false }
const EIGHTH = Math.PI / 4

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

/** The figure layer the renderer made, if it made one. */
function figureLayerOf(layers: ViewLayers3d | undefined): FigureLayer | undefined {
  const layer = layers?.figures as FigureLayer | undefined
  return layer !== undefined && typeof layer.add === 'function' ? layer : undefined
}

/** What a cell is painted from: the pose the view held when the cell was asked for. */
interface Held {
  readonly state: FigureState
  readonly time: number
  readonly key: string
}

/**
 * A figure standing on its component's position (its feet at `y`), interpolated between ticks and turned by `yaw`:
 * `views: { [Hero.id]: figure(wick, { library, motion, state: (c) => ({ moving: c.hero?.speed !== 0 }) }) }`. It is drawn
 * by the renderer's figure layer, which needs the renderer's `look`: without a layer the figure is not drawn, and
 * says so once.
 */
export function figure(def: FigureDef, options: FigureViewOptions): View3dFactory {
  const rig = skeleton(def)
  const gait = gaitOf(def, options.motion.gaits)
  const hairDynamics = hairOf(def)
  const now = options.now ?? (() => performance.now() / 1000)
  const measure = options.measure ?? (() => performance.now())
  const warn = options.warn ?? ((message: string) => console.warn(message))
  const stateOf = options.state ?? (() => STANDING)
  const face = faceOf(def)
  let warned = false
  let warnedNoLayer = false

  return (row, componentId, _models, _light, layers) => {
    const container = new Container3D()
    const layer = figureLayerOf(layers)
    if (layer === undefined && !warnedNoLayer) {
      warnedNoLayer = true
      warn(
        `figure on ${componentId ?? 'an entity'} is not drawn: the renderer has no figure layer (give it a look)`,
      )
    }
    let built: Built
    let painter: PaintFigure
    let dressed = ''
    let posed = ''
    let outfitNow = def.default
    let itemNow: string | null = null
    let held: Held | undefined
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
      painter = paintFigure(def, rig, built, outfit)
      const took = measure() - started
      if (took > FIGURE_BUILD_BUDGET_MS && !warned) {
        warned = true
        warn(
          `figure on ${componentId ?? 'an entity'} took ${Math.round(took)} ms to build (budget ${FIGURE_BUILD_BUDGET_MS} ms)`,
        )
      }
      dressed = `${outfit}|${item ?? ''}`
      outfitNow = outfit
      itemNow = item
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
      const figureState: FigureState = {
        ...state,
        speed,
        facing: 0,
        aim,
        item: item ?? undefined,
        hair: { pitch: hair.pitch, roll: hair.roll },
      }
      const { world } = evaluate(rig, def, figureState, time, options.motion, {
        previous,
        warn,
        warned: warnedClips,
      })
      previous = time
      head = world[J.head]
      held = { state: figureState, time, key }
    }

    // The cell for a view is painted from the pose held now: its sprite cheats (the head's tip toward the camera) are
    // the view's, so the pose is evaluated for the view, and the soup it makes is painted.
    let last: FoundCell | undefined
    const asLayerFigure: LayerFigure = {
      place: () => ({
        at: [container.position.x, container.position.y, container.position.z],
        yaw: container.rotation.y,
      }),
      cell(view, cache: CellCache, queue: PaintQueue, priority) {
        if (held === undefined) return last
        const pose = held
        const fig = painter
        const direction = ((Math.round(view.yaw / EIGHTH) % 8) + 8) % 8
        const key = cellKey({
          pose: pose.key,
          direction,
          pitch: view.pitch,
          density: view.density,
          outfit: outfitNow,
          item: itemNow,
          face: 'neutral',
        })
        const hit = cache.get(key)
        if (hit !== undefined) {
          last = { key, cell: hit }
          return last
        }
        queue.request(key, priority, () => {
          const sprite = spriteCheats(view.yaw, 0, view.pitch, face, gait.headLead)
          const { world } = evaluate(rig, def, pose.state, pose.time, options.motion, {
            sprite,
            warn,
            warned: warnedClips,
          })
          const painted = paintPosed(fig, soupOf(fig, rig, world, view, STYLE.supersample))
          cache.put(key, painted)
          return painted
        })
        return last
      },
    }

    placeView3d(container, row.components, undefined, 1, componentId)
    pose(stateOf(row.components))
    const remove = layer?.add(asLayerFigure)
    return {
      container,
      update(curr, prev, alpha = 1) {
        placeView3d(container, curr, prev, alpha, componentId)
        pose(stateOf(curr))
      },
      destroy() {
        remove?.()
        container.destroy({ children: true })
      },
    }
  }
}
