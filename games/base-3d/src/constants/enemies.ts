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
  /** At half health or less its windups are `ANGER_SHORTEN` ticks shorter (the Captain, §8.3). */
  readonly anger?: boolean
  /** Angry, it calls one `kind` at a time from the area's vents, every `every` ticks, while fewer than `most` live. */
  readonly calls?: { readonly kind: string; readonly every: number; readonly most: number }
  /**
   * A mini-boss or the boss: its defeat raises `captain.defeated` (the doors, the chest) or `boss.defeated` (the end)
   * instead of a roll on the drop table.
   */
  readonly rank?: 'captain' | 'warden'
  /** Hits only hurt it: no stun, push or knockdown, its move goes on (the Warden); its moves' openings still work. */
  readonly steady?: boolean
  /** At `at` health or less it enters phase 2 for good, with these attacks and this reach (the Warden, §8.4). */
  readonly phase2?: { readonly at: number; readonly attacks: readonly string[]; readonly reach: number }
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
    // The Captain's combo (§8.3): a chop with a 30-tick windup, then at once a second with its own 20 (the combo's
    // tell is the first: a follow-up is exempt from §8.1 rule 1's 24 ticks).
    id: 'captain-chop-1',
    total: 50,
    active: [31, 34],
    next: 'captain-chop-2',
    hit: {
      near: metres(0.2),
      far: metres(1.9),
      bottom: metres(0.4),
      top: metres(2.3),
      dmg: 2,
      stop: 5,
      stun: 20,
      kb: metres(2),
      power: 2,
    },
  },
  {
    id: 'captain-chop-2',
    total: 44,
    active: [21, 24],
    hit: {
      near: metres(0.2),
      far: metres(1.9),
      bottom: metres(0.4),
      top: metres(2.3),
      dmg: 2,
      stop: 5,
      stun: 20,
      kb: metres(2),
      power: 2,
    },
  },
  {
    // The Warden's hammer slam (§8.4): 40 ticks raised, then a shockwave ring 2.5 m round it. A parry on its contact
    // kneels it 90 ticks with its grate open.
    id: 'warden-slam',
    total: 70,
    active: [41, 46],
    parried: 90,
    hit: {
      near: 0,
      far: metres(2.5),
      bottom: 0,
      top: metres(1),
      dmg: 2,
      stop: 6,
      stun: 24,
      kb: metres(3),
      power: 2,
      around: true,
    },
  },
  {
    // The grate swipe: 36 ticks, blockable; a parry opens nothing.
    id: 'warden-swipe',
    total: 60,
    active: [37, 44],
    parried: 0,
    hit: {
      near: metres(0.3),
      far: metres(2.8),
      bottom: metres(0.3),
      top: metres(2),
      dmg: 2,
      stop: 5,
      stun: 20,
      kb: metres(3),
      power: 2,
    },
  },
  {
    // Phase 2's ember breath: 48 ticks of inhale, its mouth open to a pellet (120 ticks of stagger), then a cone 70°
    // wide and 5 m long that no shield stops and a pillar does.
    id: 'warden-breath',
    total: 90,
    active: [49, 70],
    opening: { from: 1, to: 48, stagger: 120 },
    hit: {
      near: 0,
      far: metres(5),
      ...FLOOR_UP,
      dmg: 2,
      stop: 4,
      stun: 20,
      kb: metres(2),
      power: 2,
      unblockable: true,
      cone: 6_372,
    },
  },
  {
    // The charge: 40 ticks, then 8 m in a straight line across the arena; a bomb in its path downs it 90 ticks.
    id: 'warden-charge',
    total: 90,
    active: [41, 70],
    lunge: metres(8),
    downed: 90,
    hit: {
      near: 0,
      far: metres(1.2),
      bottom: 0,
      top: metres(2.5),
      dmg: 2,
      stop: 5,
      stun: 20,
      kb: metres(5),
      power: 2,
    },
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

/** The three types (§8.2), the Captain (§8.3) and the Warden (§8.4), by their index + 1 in `Enemy.kind`. */
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
  {
    // The Ash Knight Captain (§8.3): the knight, 2.1 m and 14 health, opening with its combo.
    id: 'ash-captain',
    health: 14,
    radius: metres(0.45),
    height: metres(2.1),
    lift: 0,
    speed: perTick(1.6),
    turn: turnPerTick(150),
    notice: metres(8),
    reach: metres(1.5),
    attacks: ['captain-chop-1', 'knight-chop', 'knight-bash'],
    recover: 30,
    shield: true,
    anger: true,
    calls: { kind: 'sootling', every: 240, most: 2 },
    rank: 'captain',
  },
  {
    // The Ashen Warden (§8.4): 3.2 m, 24 health, phase 2 at 12.
    id: 'warden',
    health: 24,
    radius: metres(0.8),
    height: metres(3.2),
    lift: 0,
    speed: perTick(1.2),
    turn: turnPerTick(90),
    notice: metres(14),
    reach: metres(2),
    attacks: ['warden-slam', 'warden-swipe'],
    recover: 40,
    rank: 'warden',
    steady: true,
    phase2: { at: 12, attacks: ['warden-breath', 'warden-charge'], reach: metres(4) },
  },
]

/** The id of the enemy type with `kind` (its index + 1), or undefined. */
export const enemyOf = (kind: number): EnemyDef | undefined => ENEMIES[kind - 1]

/** An enemy's brain (§8.1 rule 5), as `Enemy.brain` holds it. */
export const BrainState = { idle: 0, notice: 1, approach: 2, circle: 3, attack: 4, recover: 5 } as const

/** An angry enemy's windups are this many ticks shorter (§8.3: the Captain at half health). */
export const ANGER_SHORTEN = 4
/** The shortest windup an enemy opens an attack with (§8.1 rule 1). */
export const MIN_WINDUP = 24

/**
 * The windup frames an angry enemy skips on `move` (§8.3): `ANGER_SHORTEN`, except that an attack it opens with keeps
 * §8.1 rule 1's `MIN_WINDUP` (the bash's 24 stay 24). A combo's follow-up (`opener` false) loses all 4.
 */
export function angerSkip(move: MoveDef, opener: boolean): number {
  const windup = move.active[0] - 1
  return opener ? Math.max(0, Math.min(ANGER_SHORTEN, windup - MIN_WINDUP)) : ANGER_SHORTEN
}
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
