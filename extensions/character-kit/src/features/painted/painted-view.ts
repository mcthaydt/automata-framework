// A painted figure as an entity's view in the 3D renderer: the builder paints its cell for the camera's view, and the camera's
// painted stage (painted-stage.ts) places it by the stage contract and draws it with per-texel depth, standing where the
// entity stands and turned the way it faces. The entity owns the figure's place and facing (the sim decides them); the
// painter only draws them.
import { placeView3d, type SceneLight, type View3dFactory } from '@automata/3d'
import { Container3D } from '@pixi/3d'
import type { Cell, CharacterDef, V3 } from '../../shared/figure-builder/door.ts'
import { type PaintedStage, type StageMember, stageFor } from './painted-stage.ts'
import { Painter } from './painter.ts'
import { DEFAULT_DENSITY } from './place.ts'
import { type RoomLight, roomLight } from './room-light.ts'
import { checkState, type PaintedState } from './state.ts'

export type { PaintedState } from './state.ts'

/** An entity's components, as the renderer hands them to a view. */
type Components = Parameters<typeof placeView3d>[1]

export interface PaintedFigureOptions {
  /** Texels per texel of the base cell: 1 is 64 × 96, 2 is 128 × 192 (the default, the builder's working resolution) and 4. */
  readonly density?: 1 | 2 | 4 | undefined
  /**
   * Whether a texel is a whole number of pixels (the default) or the figure stands at its true height, a texel `zoom / density`
   * pixels wide with uneven widths on screen (the way The Last Light draws its figures). With density 1 this is the old game's
   * size: 36.9 texels a metre.
   */
  readonly crisp?: boolean | undefined
  /** The figure's state from the entity's components; standing by default. */
  readonly state?: ((components: Components) => PaintedState) | undefined
  /** Seconds, for the figure's pose clock; the page's clock by default. */
  readonly now?: (() => number) | undefined
  /**
   * Whether the room's light is on the figure: by default true when the renderer has `lighting`, and the figure takes its
   * flat light, a step of form and a rim from the lamps and the sun where it stands. `false` keeps it as the painter drew it.
   */
  readonly lit?: boolean | undefined
}

const STANDING: PaintedState = { moving: false }

/** The renderer's light on the figure at `at`, seen from `azimuth`; none when the renderer has no `lighting`. */
function roomOf(
  light: SceneLight | undefined,
  at: V3,
  azimuth: number,
  figure: number | undefined,
): RoomLight | undefined {
  if (light === undefined) return undefined
  // With the figure's own luma the room exposes it toward the floor as the room shows it (`SceneLight.groundLuma`).
  const exposure =
    figure === undefined
      ? undefined
      : { ground: (x: number, z: number, y: number) => light.groundLuma(x, z, y), figure }
  return roomLight(
    (x, y, z, normal) => light.tint(x, y, z, normal),
    light.lighting.sun,
    at,
    azimuth,
    exposure,
  )
}

/** The mean luma (0 to 1) of a painted cell's opaque texels: how bright the figure is before the room lights it. */
export function paintedLuma(cell: Pick<Cell, 'painted'>): number | undefined {
  const { painted } = cell
  let sum = 0
  let count = 0
  for (let k = 0; k < painted.length; k += 4) {
    if ((painted[k + 3] ?? 0) < 128) continue
    sum += 0.2126 * (painted[k] ?? 0) + 0.7152 * (painted[k + 1] ?? 0) + 0.0722 * (painted[k + 2] ?? 0)
    count += 1
  }
  return count === 0 ? undefined : sum / count / 255
}

/**
 * A painted figure for `views` in `createPixi3dRenderer`: `views: { [Hero.id]: paintedFigure(BASE[0].def) }`. The
 * entity's component holds its pose (`x`, `y`, `z`, `yaw`); a renderer that hands its views no camera draws nothing.
 * `state` may name one of the builder's stands (`pose`) and one of the character's outfits (`outfit`): a name that does not
 * exist throws, in words, the first time the entity is drawn.
 */
export function paintedFigure(def: CharacterDef, options: PaintedFigureOptions = {}): View3dFactory {
  const now = options.now ?? (() => performance.now() / 1000)
  const stateOf = options.state ?? (() => STANDING)
  const density = options.density ?? DEFAULT_DENSITY
  return (row, componentId, _models, light, camera) => {
    if (camera === undefined) return undefined
    const stage: PaintedStage = stageFor(camera)
    const node = new Container3D()
    const painter = new Painter(def, density)
    let facing = Math.PI
    let state = STANDING
    let last = now()
    // The last frame's painted luma: the figure's own brightness, which exposure holds against the floor (none in the first frame).
    let luma: number | undefined
    let onStage: { remove(): void } | undefined
    // The room's cast shadow for this figure, when the renderer has lighting and the look's `shadow` switch is on.
    const shadow = light?.shadows?.add(node)
    const figure: StageMember = {
      node,
      placing: { density, crisp: options.crisp },
      shadow,
      frame(view) {
        const t = now()
        const at: V3 = [node.position.x, node.position.y, node.position.z]
        const seen = view(at)
        const room = options.lit === false ? undefined : roomOf(light, at, seen.azimuth, luma)
        const cell = painter.paint({ t, dt: Math.max(0, t - last), facing, state, view: seen, light: room })
        if (room !== undefined) luma = paintedLuma(cell)
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
        shadow?.destroy()
        node.destroy({ children: true })
      },
    }
  }
}
