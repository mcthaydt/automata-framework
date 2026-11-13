// A painted figure as an entity's view in the 3D renderer: the builder paints its cell for the camera's view, and the camera's
// painted stage (painted-stage.ts) places it by the stage contract and draws it with per-texel depth, standing where the
// entity stands and turned the way it faces. The entity owns the figure's place and facing (the sim decides them); the
// painter only draws them.
import { placeView3d, type SceneLight, type View3dFactory } from '@automata/3d'
import { Container3D } from '@pixi/3d'
import type { CharacterDef, V3 } from '../../shared/figures/door.ts'
import { AutoPainter } from './auto-painter.ts'
import type { Density } from './density.ts'
import { holdFacing } from './facing-hold.ts'
import { type PaintedStage, type StageMember, stageFor } from './painted-stage.ts'
import { DEFAULT_DENSITY } from './place.ts'
import { type Exposure, type RoomLight, roomLight } from './room-light.ts'
import { checkState, type PaintedState } from './state.ts'

export type { PaintedState } from './state.ts'

/** An entity's components, as the renderer hands them to a view. */
type Components = Parameters<typeof placeView3d>[1]

export interface PaintedFigureOptions {
  /**
   * Texels per texel of the base cell: 1 is 64 × 96, 2 is 128 × 192 (the default, the builder's working resolution), 4 and 8. `'auto'`
   * paints at the density the camera drawing the figure needs, each frame, by `densityNeeded`: a far camera at 1, a close shot at 4, so a
   * texel is no coarser than a screen pixel where the painter can make it so. A number pins it; a function is asked each frame (a game
   * that holds one density in play and another in its cutscenes).
   */
  readonly density?: Density | 'auto' | (() => Density) | undefined
  /**
   * The highest density `'auto'` may pick: 4 by default, since a new cell at 8 takes four times as long to paint as one at 4 and holds
   * 4.5 MB. A game whose close shots are close enough to use 8 (a texel a pixel at zoom 8) lifts it.
   */
  readonly maxDensity?: Density | undefined
  /** The character each density paints, when a figure is dressed differently where its texels can hold more (`AutoPainterOptions.defFor`); `def` by default. */
  readonly defFor?: ((density: Density) => CharacterDef) | undefined
  /**
   * Whether a texel is a whole number of pixels (the default) or the figure stands at its true height, a texel `zoom / density`
   * pixels wide with uneven widths on screen (the way a classic 2.5D game draws its figures). With density 1 this is the old game's
   * size: 36.9 texels a metre.
   */
  readonly crisp?: boolean | undefined
  /**
   * Whether the figure moves on its texel lattice (`PlaceOptions.grid`): its texels then always lie on the field's grid of whole
   * texels, where a mesh drawn between texels at the screen's pixels misses them. Off by default.
   */
  readonly grid?: boolean | undefined
  /** The figure's state from the entity's components; standing by default. */
  readonly state?: ((components: Components) => PaintedState) | undefined
  /** Seconds, for the figure's pose clock; the page's clock by default. */
  readonly now?: (() => number) | undefined
  /**
   * Whether the room's light is on the figure: by default true when the renderer has `lighting`, and the figure takes its
   * flat light, a step of form and a rim from the lamps and the sun where it stands. `false` keeps it as the painter drew it.
   */
  readonly lit?: boolean | undefined
  /**
   * Whether a face keeps its skin's hue in the room's light (false by default, the lit sprite's own): where the room darkens the skin it
   * takes the shade of the same hue and not a mauve or purple DUEL step, and the room's colour never tints it. The skin colours are the
   * character's skin swatch's painted tones, line and fold (`skinColours`). It costs a second lit sprite on each new lit cell, when the room's light has a colour.
   */
  readonly holdSkinHue?: boolean | undefined
  /**
   * The most whole steps (a step is 1.17 times) the room may take the figure under its painted colours: unset, a dark room takes a face
   * down until its brows, whites and mouth are lost in the dark (a dim ward at density 2 dims her skin to a few steps over black). Set, the
   * face stays within that many steps of the painter's own, and the lamps' side and rim still come on top. See `roomLight`.
   */
  readonly dimmest?: number | undefined
}

const STANDING: PaintedState = { moving: false }

/**
 * The renderer's light on the figure at `at`, seen from `azimuth`; none when the renderer has no `lighting`. The room exposes the
 * figure toward the floor as it shows it (`SceneLight.groundLuma`), by the trial the painter gives (`shownAt`).
 */
function roomOf(
  light: SceneLight | undefined,
  at: V3,
  azimuth: number,
  shownAt: Exposure['shownAt'],
  dimmest?: number | undefined,
): RoomLight | undefined {
  if (light === undefined) return undefined
  return roomLight(
    (x, y, z, normal) => light.tint(x, y, z, normal),
    light.lighting.sun,
    at,
    azimuth,
    {
      ground: (x, z, y) => light.groundLuma(x, z, y),
      shownAt,
    },
    dimmest,
  )
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
  return (row, componentId, _models, light, camera) => {
    if (camera === undefined) return undefined
    const stage: PaintedStage = stageFor(camera)
    const node = new Container3D()
    const painter = new AutoPainter(def, {
      density: options.density ?? DEFAULT_DENSITY,
      maxDensity: options.maxDensity,
      defFor: options.defFor,
      holdSkinHue: options.holdSkinHue,
    })
    let facing = Math.PI
    // The eighth drawn last frame, held against flicker as the camera turns (`holdFacing`).
    let held: number | undefined
    let state = STANDING
    let last = now()
    let onStage: { remove(): void } | undefined
    // The room's cast shadow for this figure, when the renderer has lighting and the look's `shadow` switch is on.
    const shadow = light?.shadows?.add(node)
    const figure: StageMember = {
      node,
      placing: { crisp: options.crisp, grid: options.grid },
      shadow,
      frame(view, zoom) {
        const t = now()
        const at: V3 = [node.position.x, node.position.y, node.position.z]
        const seen = view(at)
        const shown = holdFacing(facing, seen.azimuth, held)
        held = shown.eighth
        const cell = painter.paint(
          {
            t,
            dt: Math.max(0, t - last),
            facing: shown.facing,
            state,
            view: seen,
            light:
              options.lit === false
                ? undefined
                : (shownAt) => roomOf(light, at, seen.azimuth, shownAt, options.dimmest),
          },
          zoom,
        )
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
