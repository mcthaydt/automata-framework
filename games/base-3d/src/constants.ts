// The numbers base-3d's sim reads (DESIGN.md §3.1). Positions are Q16.16 metres (`Q16` to a metre, the stick
// mapper's unit); angles are turn units (65,536 to a turn, the heading's unit). They become tunables in
// content/tuning.toml with GAME-3D.1k.
import { Q16 } from '@mcthaydt/automata-render-pixi3d/sim'

/** Fixed steps a second: the sim's default, which the page runs at (`defineGame` takes no `tickHz`). */
export const TICK_HZ = 60
/** Metres to Q16.16, rounded to the nearest unit: content is authored in metres. */
export const metres = (value: number): number => Math.round(value * Q16)
/** Wick's walk at a full push, in metres a second. */
export const WALK_SPEED = 4
/** The walk in Q16.16 metres a tick: round(4 × 65,536 / 60) = 4,369. */
export const WALK_PER_TICK = Math.round((WALK_SPEED * Q16) / TICK_HZ)
/** Half the side of the square Wick collides as, 0.3 m (his hurt radius, DESIGN.md §7.3). */
export const HERO_HALF = metres(0.3)
/** How far the lock reaches in plan, 12 m (DESIGN.md §11.1). */
export const LOCK_RANGE = metres(12)
/** With nothing in the lock's cone, the nearest target this near in any direction, 6 m (DESIGN.md §11.1). */
export const LOCK_FALLBACK = metres(6)
/** A lock lets go of a target farther than 15 m (DESIGN.md §11.2). */
export const LOCK_BREAK = metres(15)
/** A lock lets go of a target out of sight this many ticks running, 1 s (DESIGN.md §11.2). */
export const LOCK_HIDDEN_TICKS = 60
/** The assist leaves the heading alone while the target is within 45° of it: 8,192 turn units (GAME3D-D5). */
export const LOCK_ASSIST_LIMIT = 8_192
/** The assist's turn a tick: 180° a second at 60 Hz, round(32,768 / 60) = 546 turn units (GAME3D-D5). */
export const LOCK_ASSIST_PER_TICK = 546
/** How near the ember a pickup must start to take it, 1 m each way in plan (a square, so no square root). */
export const EMBER_REACH = metres(1)
/** Each action's code in `HeroAction.clip` (0 is none); the figure plays the clip of the same name (M3 spec §4.7). */
export const ACTION_CLIP = { slash: 1, point: 2, pickup: 3, move: 4 } as const
/** Each action's length in ticks at 60 Hz: its clip's `length` (0.4 s, 0.8 s, 0.9 s), which the content test checks. */
export const ACTION_TICKS = { slash: 24, point: 48, pickup: 54 } as const
/** Each action button's bit in `HeroControl.actHeld` and `actPressed`. */
export const ACTION_BITS = { slash: 1, guard: 2, point: 4, pickup: 8, action: 16 } as const
/** The area change's fade out, 300 ms (DESIGN.md §13): the sim swaps the area this many ticks after the exit. */
export const AREA_FADE_TICKS = 18

/** Wick's health at the start, in half-hearts: 4 hearts (DESIGN.md §7.8). */
export const HERO_HEALTH = 8
/** Wick's hurt cylinder's height, 1.6 m; its radius is `HERO_HALF` (DESIGN.md §7.3). */
export const HERO_HEIGHT = metres(1.6)
/** A training dummy (the area's targets, until GAME-3D.1d's enemies): 3 hearts, 0.4 m across, 1.8 m tall. */
export const DUMMY = { health: 6, radius: metres(0.4), height: metres(1.8) } as const
/** Where a dummy faces, a half turn: back toward the doorway, as the view drew it before it had a facing. */
export const DUMMY_FACING = 32_768

/** A fighter's state (DESIGN.md §7.1, The Last Light's `State` minus `air`), as `Fighter.state` holds it. */
export const CombatState = {
  idle: 0,
  act: 1,
  stun: 2,
  blockstun: 3,
  stagger: 4,
  down: 5,
  defeated: 6,
  rise: 7,
  fall: 8,
} as const

/** What a move's active frames reach: a band along the facing and a height band, in Q16.16 metres (§7.3). */
export interface MoveHit {
  readonly near: number
  readonly far: number
  readonly bottom: number
  readonly top: number
  /** Damage in half-hearts. */
  readonly dmg: number
  /** Hitstop ticks (§7.5). */
  readonly stop: number
  /** The defender's stun in ticks. */
  readonly stun: number
  /** Knockback in Q16.16 metres a second, along the attacker's facing, for the stun's ticks. */
  readonly kb: number
  /** 1 to 3: the shake's size (part 3), and a knockdown at 3 (part 2). */
  readonly power: number
  /** Under the shield: a `low` hit is never blocked, nor is an unblockable one (§7.4). */
  readonly low?: boolean
  readonly unblockable?: boolean
  /** A ring round the attacker (`brawl/moves.ts` `around`): every defender within `far` (plus its radius) is reached. */
  readonly around?: boolean
}

/**
 * One move's frame data (DESIGN.md §7.1, The Last Light's `src/fight/moves.ts` `Move` at `92e6704`): frames count
 * from 1 on the tick the move starts, as the source's do. `window` is when the next press starts `next` (§7.2).
 */
export interface MoveDef {
  readonly id: string
  /** The figure clip it plays, retimed to `total` (§7.2); its `contact` marker lands on the active start (G3-d). */
  readonly clip?: string
  readonly total: number
  readonly active: readonly [number, number]
  readonly window?: readonly [number, number]
  readonly next?: string
  readonly hit?: MoveHit
  /** Carried this far (Q16.16 metres) over the move's frames, evenly (a roll, a hop). */
  readonly travel?: number
  /** Frames on which no hit lands on the fighter. */
  readonly invuln?: readonly [number, number]
  /** The hurt cylinder's height while the move runs (a roll is 0.9 m, §7.3). */
  readonly height?: number
}

/** A slash's reach: 0.2 m to 1.4 m ahead, from the knee to above the shoulder. Not in §7.2's table; a starting value. */
const SLASH_REACH = { near: metres(0.2), far: metres(1.4), bottom: metres(0.6), top: metres(1.5) }

/**
 * Wick's sword (DESIGN.md §7.2's starting frame data). They become `content/moves` and tuning.toml rows with 1j and
 * 1k (§17); constants until then, as the other numbers here are. Spin, roll and the hops are GAME-3D.1c part 2.
 */
export const HERO_MOVES: readonly MoveDef[] = [
  {
    id: 'slash-1',
    clip: 'slash-1',
    total: 22,
    active: [6, 9],
    window: [10, 18],
    next: 'slash-2',
    hit: { ...SLASH_REACH, dmg: 1, stop: 4, stun: 18, kb: metres(1.5), power: 1 },
  },
  {
    id: 'slash-2',
    clip: 'slash-2',
    total: 24,
    active: [7, 10],
    window: [11, 19],
    next: 'thrust',
    hit: { ...SLASH_REACH, dmg: 1, stop: 5, stun: 20, kb: metres(1.5), power: 1 },
  },
  {
    id: 'thrust',
    clip: 'thrust',
    total: 34,
    active: [10, 14],
    hit: { ...SLASH_REACH, far: metres(1.8), dmg: 2, stop: 8, stun: 30, kb: metres(4), power: 3 },
  },
  {
    id: 'spin',
    clip: 'spin',
    total: 36,
    active: [8, 20],
    hit: {
      ...SLASH_REACH,
      near: 0,
      far: metres(1.6),
      dmg: 2,
      stop: 6,
      stun: 24,
      kb: metres(3),
      power: 2,
      around: true,
    },
  },
  {
    id: 'roll',
    clip: 'roll',
    total: 24,
    active: [0, 0],
    travel: metres(3.2),
    invuln: [2, 12],
    height: metres(0.9),
  },
  { id: 'hop-side', clip: 'hop-side', total: 20, active: [0, 0], travel: metres(2), invuln: [2, 10] },
  { id: 'hop-back', clip: 'hop-back', total: 20, active: [0, 0], travel: metres(2), invuln: [2, 10] },
]

/** A press from this frame of a slash to the end of its window queues the next (§7.2, buffering). */
export const BUFFER_FROM = 4
/** The shield's arc: 120°, so ±10,923 turn units around the facing (§7.4). */
export const GUARD_HALF_ARC = 10_923
/** A hit on the guard's frames 1 to 8 is parried (§7.4). */
export const PARRY_FRAMES = 8
/** A parried attacker staggers this many ticks, under this much hitstop (§7.4, the source's numbers). */
export const PARRY_STAGGER = 28
export const PARRY_FREEZE = 14
/** A block: blockstun, the push in Q16.16 metres a second, the attacker's hitstop (§7.4). */
export const BLOCK_STUN = 12
export const BLOCK_PUSH = metres(2.4)
export const BLOCK_FREEZE = 4
/** Wick hurt: stunned 18 ticks, then not hit again for 60 from the hit (§7.2 `hurt`). */
export const HURT_STUN = 18
export const HURT_IFRAMES = 60
/** At 0 health Wick is down this long before the game over; a power-3 hit downs anyone this long (§7.2 `knockdown`). */
export const KNOCKDOWN_TICKS = 40
/** A hit of this power or more knocks the defender down (§7.2: the thrust, 1d's bombs). */
export const KNOCKDOWN_POWER = 3
/** Getting up after a knockdown (§7.2 `rise`). Nothing lands while down or rising. */
export const RISE_TICKS = 14
/** Attack held this many ticks, then released, spins (§7.2 `spin`). */
export const SPIN_CHARGE = 40
/** A fall into a pit: its length, its cost in half-hearts and the i-frames after it (§7.8). */
export const FALL_TICKS = 60
export const FALL_COST = 1
export const FALL_IFRAMES = 60
/** The game over's Continue: 3 hearts (§7.8). */
export const CONTINUE_HEALTH = 6
