// base-3d's Koota traits (DESIGN.md §3.1). Positions are Q16.16 metres and angles turn units (constants.ts); the
// renderer converts them to metres and radians (M3.7b). The camera's view and heading are render-pixi3d's
// `camera-heading`, on the same entity as `hero` (M3 spec §4.2, one owner).
import { type ComponentDef, defineComponent } from '@mcthaydt/automata-sim'

const heroFields = {
  x: 'i32',
  z: 'i32',
  /** Where Wick faces, in turn units (0 toward +z, growing toward +x). */
  facing: 'u32',
  /** Whether the stick moved him this tick. */
  moving: 'bool',
  /**
   * His travel relative to his facing, in turn units: 0 forward, ±16,384 a strafe, −32,768 backing away. Angles
   * grow toward +x, so negative is to his right (clockwise seen from above) and positive to his left.
   */
  moveDir: 'i32',
  /** The entity he is locked onto; 0 when none. */
  lockTarget: 'entity',
  /** The ticks running the locked target has been out of his line of sight; at 60 the lock lets go. */
  lockHidden: 'u32',
} as const

/** Wick, the player, as the renderer reads him (the figure's `FigureState`, M3 spec §4.4.5). */
export const Hero: ComponentDef<typeof heroFields> = defineComponent('hero', heroFields)

const controlFields = {
  stickX: 'i32',
  stickY: 'i32',
  lockHeld: 'bool',
  lockPressed: 'bool',
  /** Whether the player's Lock mode is hold (the release lets go) rather than toggle (the next press does). */
  lockHold: 'bool',
  /** This tick's `lock-cycle`: 1 clockwise, −1 anticlockwise, 0 none. */
  lockCycle: 'i32',
  /** The action buttons held this tick and pressed this tick, as `ACTION_BITS` (slash 1, guard 2, point 4, pickup 8). */
  actHeld: 'u32',
  actPressed: 'u32',
} as const

/**
 * This tick's input: the stick (−127..127, y down), whether lock is held, and whether it went down this tick
 * (`lockPressed`, true only on the press, so holding it never locks again), and the action buttons likewise. Not
 * rendered.
 */
export const HeroControl: ComponentDef<typeof controlFields> = defineComponent(
  'hero-control',
  controlFields,
  {
    render: false,
  },
)

const targetFields = { x: 'i32', z: 'i32' } as const

/** Something Wick can lock onto, standing at `x`, `z`. */
export const Target: ComponentDef<typeof targetFields> = defineComponent('target', targetFields)

const actionFields = {
  /** The action playing, as `ACTION_CLIP` (0 none, 1 slash, 2 point, 3 pickup). */
  clip: 'u32',
  /** The tick it started on: the figure samples its clip from here. */
  startedAt: 'u32',
  /** Whether the guard stance is held, and the tick it was raised on. */
  guard: 'bool',
  guardSince: 'u32',
} as const

/** Wick's action and stance, as the figure reads them (`FigureState.action` and `stances`, M3 spec §4.4.5). */
export const HeroAction: ComponentDef<typeof actionFields> = defineComponent('hero-action', actionFields)
