// What a painted figure draws this frame: the builder's own painter, for the view the camera gives it. A figure that walks
// or stands is stepped by the frame's time (`Figure`, the way the review sheets step one); a figure that holds one of the
// builder's library stands is posed by a `ScriptedActor`, the one route the builder exposes for a stand with its hands
// placed at the outfit's openings. Each is the builder's work, never the kit's: this file chooses between them and keeps
// them.
import {
  type CastMember,
  type Cell,
  type CharacterDef,
  cellOf,
  Figure,
  member,
  ScriptedActor,
  type View,
} from '../../shared/figures/door.ts'
import type { Density } from './density.ts'
import { litCells } from './lit-cells.ts'
import type { Exposure, RoomLight } from './room-light.ts'
import { sharedColours, skinColours } from './skin-hue.ts'
import type { PaintedState } from './state.ts'

/** An eighth of a turn: the painter draws the nearest of 8 directions, so a stand needs only 8 facings. */
const EIGHTH = Math.PI / 4

export interface PaintInput {
  /** Seconds, for the figure's pose clock and a stand's blend. */
  readonly t: number
  /** Seconds since the last frame. */
  readonly dt: number
  /** The figure's facing in the builder's terms: 0 toward +z. */
  readonly facing: number
  readonly state: PaintedState
  /** The view the camera gives it this frame. */
  readonly view: View
  /**
   * The room's light where it stands, when the figure is lit (`lit-cells.ts`); unlit without one. A function is given the trial of
   * this frame's figure, how bright it shows lit by a candidate light, to choose the light by (the exposure, `room-light.ts`).
   */
  readonly light?: RoomLight | ((shownAt: Exposure['shownAt']) => RoomLight | undefined) | undefined
  /**
   * The figure's own clock, when it is kept outside the painter (several painters of one figure, `auto-painter.ts`, each stepped by the
   * same time): a figure left to itself adds each frame's `dt`, which is the same number when it is stepped every frame.
   */
  readonly clock?: number | undefined
}

export class Painter {
  private readonly cast: CastMember
  private readonly figures = new Map<string | undefined, Figure>()
  private readonly stands = new Map<string, ScriptedActor>()
  /** The lit cells of this figure, kept by the painted cell and the quantised light. */
  private readonly cells: ReturnType<typeof litCells>

  constructor(
    private readonly def: CharacterDef,
    private readonly density: Density,
    options: { readonly holdSkinHue?: boolean | undefined } = {},
  ) {
    this.cast = member(def, density)
    this.cells = litCells(
      undefined,
      options.holdSkinHue === true ? { skin: skinColours(def), shared: sharedColours(def) } : {},
    )
  }

  /** The cell for this frame, valid until the next one. */
  paint({ t, dt, facing, state, view, light, clock }: PaintInput): Cell {
    if (!state.moving && state.pose !== undefined)
      return this.cell(this.stand(state, facing).draw(t, view, this.density), light)
    const figure = this.figure(state.outfit)
    figure.update(dt, { facing, moving: state.moving, view, ...(clock === undefined ? {} : { clock }) })
    return this.cell(figure, light)
  }

  /** The figure's cell, lit by the room when there is one: its `painted` stays the unlit cell either way. */
  private cell(figure: Figure, input: PaintInput['light']): Cell {
    const light =
      typeof input === 'function' ? input((candidate) => this.cells.shown(figure, candidate)) : input
    return light === undefined ? cellOf(figure) : this.cells.lit(figure, light)
  }

  private figure(outfit: string | undefined): Figure {
    let figure = this.figures.get(outfit)
    if (figure === undefined) {
      figure = new Figure(this.cast, outfit)
      this.figures.set(outfit, figure)
    }
    return figure
  }

  /** The actor that holds `state.pose` in `state.outfit` facing the eighth of a turn nearest `facing`: one each, kept. */
  private stand(state: PaintedState, facing: number): ScriptedActor {
    const eighth = ((Math.round(facing / EIGHTH) % 8) + 8) % 8
    const key = `${state.outfit ?? ''}|${state.pose}|${eighth}`
    let actor = this.stands.get(key)
    if (actor === undefined) {
      actor = new ScriptedActor(
        {
          who: this.def,
          ...(state.outfit === undefined ? {} : { outfit: state.outfit }),
          at: [0, 0],
          facing: eighth * 45,
          stands: [{ t: 0, pose: state.pose as string }],
        },
        { density: this.density },
      )
      this.stands.set(key, actor)
    }
    return actor
  }
}
