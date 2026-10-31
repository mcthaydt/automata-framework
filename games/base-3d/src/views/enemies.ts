// The enemies' views (DESIGN.md §8, GAME-3D.1d part 4): each `target` row drawn as its kind's figure (placeholders
// until GAME-3D.1j), the Wisp as a mesh (GAME3D-D10), a training dummy as the target figure, and the windup's glow in
// the danger colours (§8.1 rule 1, §8.5). Presentation, game code: the sim never reads any of it (law 1).
import { box, type FigureViewState, type View3dFactory } from '@mcthaydt/automata-render-pixi3d'
import { Q16 } from '@mcthaydt/automata-render-pixi3d/sim'
import type { FieldRecord } from '@mcthaydt/automata-sim'
import { type Container3D, CubeGeometry, FlatMaterial, Mesh3D, TorusGeometry } from '@pixi/3d'
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

/** The lock reticle's pulse while its target holds a token (§8.1 rule 4): once every this many ms, up to `RETICLE_GROW`. */
const RETICLE_PULSE_MS = 400
const RETICLE_GROW = 0.25

/**
 * The lock reticle over the enemy `sid` (§8.1 rule 4): shown while it is the hero's lock target (`lockedSid`, 0 for
 * none), and pulsing while it holds an attack token, so the player sees which locked foe may attack next. A training
 * dummy (no `enemy` row) has none.
 */
export function reticleOf(
  sid: number,
  components: Components,
  lockedSid: number,
  ms: number,
): { readonly scale: number } | undefined {
  if (lockedSid === 0 || sid !== lockedSid || components.enemy === undefined) return undefined
  if (components.enemy.token !== true) return { scale: 1 }
  const phase = (ms % RETICLE_PULSE_MS) / RETICLE_PULSE_MS
  return { scale: 1 + RETICLE_GROW * (1 - Math.abs(1 - 2 * phase)) }
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
  /** The sid of the hero's lock target (0 for none), for the reticle. */
  readonly locked: () => number
}

/** The reticle's colour: the palette's cyan, apart from both colours of danger (§8.5), so a lock never reads as a windup. */
const RETICLE_COLOUR = 0x2ce8f5

/** The reticle torus's radius, in metres, before it is sized to its enemy. */
const RETICLE_RADIUS = 0.35
/** How far the ring lies outside the enemy's hurt cylinder, in metres. */
const RETICLE_MARGIN = 0.15

/**
 * Adds the lock reticle (`reticleOf`) to an enemy's `container`: a flat ring round its feet (`floor`, in the
 * container's own units), a little wider than its hurt cylinder (`radius`, metres) whatever the container's `scale`,
 * so it stays in view under the 25° camera for a 3.2 m Warden as for a Sootling. Returns the update that shows, hides
 * and pulses it.
 */
function addReticle(
  container: Container3D,
  geometry: TorusGeometry,
  place: { readonly floor: number; readonly radius: number; readonly scale: number },
  sid: number,
  options: EnemyViewOptions,
): (curr: Components) => void {
  const ring = new Mesh3D({ geometry, material: new FlatMaterial({ baseColor: RETICLE_COLOUR }) })
  ring.position.set(0, place.floor + 0.03 / place.scale, 0)
  ring.visible = false
  container.addChild(ring)
  const size = (place.radius + RETICLE_MARGIN) / RETICLE_RADIUS / place.scale
  return (curr) => {
    const shown = reticleOf(sid, curr, options.locked(), options.now())
    ring.visible = shown !== undefined
    if (shown !== undefined) ring.scale.set(size * shown.scale, size * shown.scale, size * shown.scale)
  }
}

/** The Wisp's ember mask until 1j authors its mesh: a small lit box, carried at its hover height. */
const wispMask = inMetres(box({ width: 0.45, height: 0.5, depth: 0.2 }, { color: 0xf77622, lit: 'moving' }))

/**
 * The view of every `target` row: a dummy (no `enemy` row) as the target figure, a Wisp as its mask raised by its
 * `lift`, and any other enemy as its kind's figure scaled to its height, with a glow at its eyes through a windup.
 */
export function enemyView(options: EnemyViewOptions): View3dFactory {
  const glowGeometry = new CubeGeometry({ width: 0.12, height: 0.06, depth: 0.06 })
  const reticleGeometry = new TorusGeometry({
    radius: RETICLE_RADIUS,
    tube: 0.03,
    radialSegments: 6,
    tubularSegments: 24,
  })
  return (row, componentId, models, light) => {
    const type = enemyOf(Number(row.components.enemy?.kind ?? 0))
    if (type === undefined) return options.dummy(row, componentId, models, light)
    if (type.id === 'wisp') {
      const view = wispMask(row, componentId, models, light)
      if (view === undefined) return undefined
      // Round the mask, at its hover height: the floor under a Wisp is no help in telling which one is locked.
      const reticle = addReticle(
        view.container,
        reticleGeometry,
        { floor: 0, radius: type.radius / Q16, scale: 1 },
        row.sid,
        options,
      )
      return {
        ...view,
        update(curr, prev, alpha) {
          view.update?.(curr, prev, alpha)
          view.container.position.y = Number(curr.fighter?.lift ?? 0) / Q16
          reticle(curr)
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
    const reticle = addReticle(
      view.container,
      reticleGeometry,
      { floor: 0, radius: type.radius / Q16, scale: drawn.scale },
      row.sid,
      options,
    )
    return {
      container: view.container,
      update(curr, prev, alpha) {
        view.update?.(curr, prev, alpha)
        const lit = windupGlow(curr, options.moves, options.now())
        glow.visible = lit !== undefined
        if (lit !== undefined) (glow.material as FlatMaterial).baseColor = dimmed(lit.colour, lit.strength)
        reticle(curr)
      },
      destroy: () => view.destroy?.(),
    }
  }
}
