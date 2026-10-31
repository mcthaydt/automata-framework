// The enemies' numbers (DESIGN.md §8.1, §8.2): the three types and their moves, as starting values that become
// tunables with GAME-3D.1k (§17), as the other constants are. A windup is a move's frames before `active` (§8.1 rule
// 1: at least 24 ticks). Positions are Q16.16 metres, angles turn units, as in index.ts.
import { type MoveDef, metres, TICK_HZ } from './index.ts'

/** A walk of `speed` metres a second, in Q16.16 metres a tick. */
const perTick = (speed: number): number => Math.round(metres(speed) / TICK_HZ)
/** A turn of `degrees` a second, in turn units a tick. */
const turnPerTick = (degrees: number): number => Math.round((degrees * 65_536) / 360 / TICK_HZ)

/** An enemy type (§8.2): its fighter, its brain's ranges and its attacks. */
export interface EnemyDef {
  readonly id: string
  /** Health in damage units, as Wick's sword deals them (a slash is 1). */
  readonly health: number
  /** The hurt cylinder (§7.3): its radius, its height, and its floor above the ground (a Wisp hovers). */
  readonly radius: number
  readonly height: number
  readonly lift: number
  /** Its walk, in Q16.16 metres a tick, and its turn, in turn units a tick. */
  readonly speed: number
  readonly turn: number
  /** It notices Wick this near in plan, with a line of sight, and starts an attack this near. */
  readonly notice: number
  readonly reach: number
  /** Its attacks, by move id, taken in turn. */
  readonly attacks: readonly string[]
  /** Ticks after an attack before it closes in again. */
  readonly recover: number
  /** Its shield blocks a frontal hit while it is not attacking or held (the Ash Knight, §8.2). */
  readonly shield?: boolean
  /** A hit while it hovers drops it to the floor, stunned, this many ticks (the Wisp and the sling, §8.2). */
  readonly grounded?: number
}

/** What a move's hit reaches when it never misses for height: from the floor to above Wick's head. */
const FLOOR_UP = { bottom: 0, top: metres(1.6) }

/** The enemies' moves (§8.2), in the world's move table after Wick's. */
export const ENEMY_MOVES: readonly MoveDef[] = [
  {
    // The Sootling crouches with its eyes lit for 30 ticks, then bites a metre forward.
    id: 'sootling-lunge',
    total: 50,
    active: [31, 33],
    lunge: metres(1),
    hit: {
      near: 0,
      far: metres(1),
      bottom: 0,
      top: metres(0.9),
      dmg: 1,
      stop: 3,
      stun: 12,
      kb: metres(1.5),
      power: 1,
    },
  },
  {
    // The Ash Knight raises its sword high for 30 ticks and chops.
    id: 'knight-chop',
    total: 56,
    active: [31, 34],
    hit: {
      near: metres(0.2),
      far: metres(1.7),
      bottom: metres(0.4),
      top: metres(2),
      dmg: 2,
      stop: 5,
      stun: 20,
      kb: metres(2),
      power: 2,
    },
  },
  {
    // It scrapes its shield for 24 ticks and bashes: no damage, but Wick is pushed 3 m back (10 m/s over his 18
    // ticks of hurt).
    id: 'knight-bash',
    total: 45,
    active: [25, 27],
    hit: { near: 0, far: metres(1.5), ...FLOOR_UP, dmg: 0, stop: 3, stun: 18, kb: metres(10), power: 1 },
  },
  {
    // The Wisp stops, flares and shrieks for 30 ticks, then dives 4 m in a straight line, down to Wick's height.
    id: 'wisp-dive',
    total: 70,
    active: [31, 50],
    lunge: metres(4),
    hit: { near: 0, far: metres(0.5), ...FLOOR_UP, dmg: 1, stop: 3, stun: 12, kb: metres(2), power: 1 },
  },
]

/** The three types (§8.2), by their index + 1 in `Enemy.kind`. */
export const ENEMIES: readonly EnemyDef[] = [
  {
    id: 'sootling',
    health: 2,
    radius: metres(0.3),
    height: metres(0.9),
    lift: 0,
    speed: perTick(2.5),
    turn: turnPerTick(360),
    notice: metres(6),
    reach: metres(1.6),
    attacks: ['sootling-lunge'],
    recover: 40,
  },
  {
    id: 'ash-knight',
    health: 6,
    radius: metres(0.4),
    height: metres(1.8),
    lift: 0,
    speed: perTick(1.6),
    // 150° a second: Wick circling it at 1.5 m and 4 m/s turns 150° a second too, so he can just get round its
    // shield, and does while it attacks or recovers.
    turn: turnPerTick(150),
    notice: metres(7),
    reach: metres(1.4),
    attacks: ['knight-chop', 'knight-chop', 'knight-bash'],
    recover: 30,
    shield: true,
  },
  {
    id: 'wisp',
    health: 2,
    radius: metres(0.3),
    // The mask and its trail of embers: on the floor, the sword's band (from 0.6 m) reaches it.
    height: metres(0.8),
    // Its floor at 2.2 m is above the sword's reach (1.5 m).
    lift: metres(2.2),
    speed: perTick(2),
    turn: turnPerTick(270),
    notice: metres(8),
    reach: metres(3),
    attacks: ['wisp-dive'],
    recover: 60,
    grounded: 120,
  },
]

/** The id of the enemy type with `kind` (its index + 1), or undefined. */
export const enemyOf = (kind: number): EnemyDef | undefined => ENEMIES[kind - 1]

/** An enemy's brain (§8.1 rule 5), as `Enemy.brain` holds it. */
export const BrainState = { idle: 0, notice: 1, approach: 2, circle: 3, attack: 4, recover: 5 } as const

/** How long an enemy that noticed Wick stands and turns toward him before it closes in. */
export const NOTICE_TICKS = 20
/** At most this many enemies hold an attack token at once (§8.1 rule 2). */
export const MAX_TOKENS = 2
/** An enemy without a token keeps this ring round Wick (§8.1 rule 2, the brawl's `watch` strafe). */
export const RING_NEAR = metres(2.9)
export const RING_FAR = metres(3.8)
/** An idle enemy paces 1 m from home and back: each leg's ticks out, still, back, still. */
export const PACE_TICKS = 60

/** What a drop is (§8.1 rule 6), as `Drop.kind` holds it. */
export const DropKind = { ember: 1, heart: 2 } as const

/**
 * The drop table (§8.1 rule 6) for a roll of 0 to 9: 0–2 nothing, 3–6 one ember, 7–8 five embers, 9 a recovery heart.
 * The pellets-and-bombs row waits for GAME-3D.1e's items.
 */
export function dropOf(roll: number): { kind: number; amount: number } | undefined {
  if (roll < 3) return undefined
  if (roll < 7) return { kind: DropKind.ember, amount: 1 }
  if (roll < 9) return { kind: DropKind.ember, amount: 5 }
  return { kind: DropKind.heart, amount: 1 }
}

/** Wick takes a drop whose place is this near his, each way in plan (a square, as the ember's reach is). */
export const DROP_REACH = metres(0.6)
/** A recovery heart heals one heart: 2 half-hearts, up to his maximum. */
export const HEART_HEAL = 2
