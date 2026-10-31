// The enemies' views (DESIGN.md §8, GAME-3D.1d part 4): each `target` row drawn as its kind's figure (placeholders
// until GAME-3D.1j), the Wisp as a mesh (GAME3D-D10), a training dummy as the target figure, and the windup's glow in
// the danger colours (§8.1 rule 1, §8.5). Presentation, game code: the sim never reads any of it (law 1).
import { box, type FigureViewState, type View3dFactory } from '@mcthaydt/automata-render-pixi3d'
import { Q16 } from '@mcthaydt/automata-render-pixi3d/sim'
import type { FieldRecord } from '@mcthaydt/automata-sim'
import { CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'
import { BrainState, ENEMY_MOVES, enemyOf } from '../constants/enemies.ts'
import { type MoveDef, TICK_HZ } from '../constants/index.ts'
import { inMetres } from './index.ts'

type Components = Readonly<Record<string, Readonly<FieldRecord>>>

/** §8.5's colours of danger (Endesga): orange for a windup that can be blocked, white-yellow for one that cannot. */
export const DANGER = { blockable: 0xf77622, unblockable: 0xfee761 } as const
/** An unblockable windup's pulse, once every this many ms, between 40% and full strength. */
const PULSE_MS = 250
/** How fast a figure-drawn enemy walks while it closes in or circles, in metres a second (its gait's speed). */
const ENEMY_WALK = 2

/**
 * Each figure-drawn type's figure and its scale (§8.2 to §8.4): the figure sliders reach 120 to 240 cm, so the
 * 0.9 m Sootling and the 3.2 m Warden are drawn from the nearest height and scaled (GAME3D-D20).
 */
export const ENEMY_FIGURES: Readonly<Record<string, { readonly figure: string; readonly scale: number }>> = {
  sootling: { figure: 'sootling', scale: 0.75 },
  'ash-knight': { figure: 'ash-knight', scale: 1 },
  'ash-captain': { figure: 'ash-captain', scale: 1 },
  warden: { figure: 'warden', scale: 3.2 / 2.4 },
}

const moveOf = (components: Components, moves: readonly MoveDef[]): MoveDef | undefined =>
  moves[Number(components.fighter?.move ?? 0) - 1]

/**
 * An enemy's figure state from its `enemy` and `fighter` rows: walking while it closes in or circles, and its running
 * move's clip from the move's start, retimed to the move (G3-d). A clip no content has is named as it is: the figure
 * view warns once and keeps the gait (G3-F7, render-pixi3d's figure view).
 */
export function enemyFigureState(components: Components, moves: readonly MoveDef[]): FigureViewState {
  const brain = Number(components.enemy?.brain ?? BrainState.idle)
  const moving = brain === BrainState.approach || brain === BrainState.circle
  const move = moveOf(components, moves)
  return {
    moving,
    speed: moving ? ENEMY_WALK : 0,
    ...(move !== undefined && {
      action: {
        id: move.clip ?? move.id,
        length: move.total / TICK_HZ,
        startedAt: Number(components.fighter?.moveStart ?? 0) / TICK_HZ,
      },
    }),
  }
}

/**
 * The glow an enemy's eyes show at `ms` (presentation time): through an enemy move's windup (its frames before the
 * first active one), orange and steady when it can be blocked, white-yellow and pulsing when it cannot, so colour is
 * never the only signal (§8.5). None otherwise.
 */
export function windupGlow(
  components: Components,
  moves: readonly MoveDef[],
  ms: number,
): { readonly colour: number; readonly strength: number } | undefined {
  const move = moveOf(components, moves)
  if (move?.hit === undefined || !ENEMY_MOVES.some((enemyMove) => enemyMove.id === move.id)) return undefined
  if (Number(components.fighter?.moveTick ?? 0) >= move.active[0]) return undefined
  if (move.hit.unblockable !== true) return { colour: DANGER.blockable, strength: 1 }
  const phase = (ms % PULSE_MS) / PULSE_MS
  return { colour: DANGER.unblockable, strength: 0.4 + 0.6 * Math.abs(1 - 2 * phase) }
}

/** `colour` (0xRRGGBB) with each channel scaled by `strength` (0 to 1). */
const dimmed = (colour: number, strength: number): number =>
  [16, 8, 0].reduce((sum, shift) => sum + (Math.round(((colour >> shift) & 0xff) * strength) << shift), 0)

export interface EnemyViewOptions {
  /** The figure view of each figure name in `ENEMY_FIGURES`, and of the training dummy. */
  readonly figures: Readonly<Record<string, View3dFactory>>
  readonly dummy: View3dFactory
  /** The world's move table, which names each move and its windup. */
  readonly moves: readonly MoveDef[]
  /** Presentation time in ms, for the pulse. */
  readonly now: () => number
}

/** The Wisp's ember mask until 1j authors its mesh: a small lit box, carried at its hover height. */
const wispMask = inMetres(box({ width: 0.45, height: 0.5, depth: 0.2 }, { color: 0xf77622, lit: 'moving' }))

/**
 * The view of every `target` row: a dummy (no `enemy` row) as the target figure, a Wisp as its mask raised by its
 * `lift`, and any other enemy as its kind's figure scaled to its height, with a glow at its eyes through a windup.
 */
export function enemyView(options: EnemyViewOptions): View3dFactory {
  const glowGeometry = new CubeGeometry({ width: 0.12, height: 0.06, depth: 0.06 })
  return (row, componentId, models, light) => {
    const type = enemyOf(Number(row.components.enemy?.kind ?? 0))
    if (type === undefined) return options.dummy(row, componentId, models, light)
    if (type.id === 'wisp') {
      const view = wispMask(row, componentId, models, light)
      if (view === undefined) return undefined
      return {
        ...view,
        update(curr, prev, alpha) {
          view.update?.(curr, prev, alpha)
          view.container.position.y = Number(curr.fighter?.lift ?? 0) / Q16
        },
      }
    }
    const drawn = ENEMY_FIGURES[type.id]
    const factory = drawn === undefined ? undefined : options.figures[drawn.figure]
    const view = factory?.(row, componentId, models, light)
    if (view === undefined || drawn === undefined) return view
    view.container.scale.set(drawn.scale, drawn.scale, drawn.scale)
    // The eyes, in the figure's own (unscaled) metres: a little under the top of its head, toward its front.
    const glow = new Mesh3D({
      geometry: glowGeometry,
      material: new FlatMaterial({ baseColor: DANGER.blockable }),
    })
    glow.position.set(0, (type.height / Q16 / drawn.scale) * 0.93, 0.12)
    glow.visible = false
    view.container.addChild(glow)
    return {
      container: view.container,
      update(curr, prev, alpha) {
        view.update?.(curr, prev, alpha)
        const lit = windupGlow(curr, options.moves, options.now())
        glow.visible = lit !== undefined
        if (lit !== undefined) (glow.material as FlatMaterial).baseColor = dimmed(lit.colour, lit.strength)
      },
      destroy: () => view.destroy?.(),
    }
  }
}
