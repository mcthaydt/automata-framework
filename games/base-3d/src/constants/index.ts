// The numbers base-3d's sim reads (the free game, DESIGN.md §0 and the rescope spec). Positions are Q16.16 metres (`Q16`
// to a metre, the stick mapper's unit); angles are turn units (65,536 to a turn, the heading's unit). The walk and the
// roll become tunables in content/tuning.toml with the Tuner (the free base-3d plan, step 8).
import { Q16 } from '@automataframework/automata-render-pixi3d/sim'

/** Fixed steps a second: the sim's default, which the page runs at (`defineGame` takes no `tickHz`). */
export const TICK_HZ = 60
/** Metres to Q16.16, rounded to the nearest unit: content is authored in metres. */
export const metres = (value: number): number => Math.round(value * Q16)
/** Wick's walk at a full push, in metres a second. */
export const WALK_SPEED = 4
/** The walk in Q16.16 metres a tick: round(4 × 65,536 / 60) = 4,369. */
export const WALK_PER_TICK = Math.round((WALK_SPEED * Q16) / TICK_HZ)
/** Half the side of the square Wick collides as, 0.3 m. */
export const HERO_HALF = metres(0.3)
/** How near an ember Wick's centre must come to take it, 0.6 m each way in plan (a square, so no square root). */
export const EMBER_REACH = metres(0.6)

/**
 * The roll, the one verb beyond walking: a lunge that carries Wick `travel` metres over `ticks` ticks (0.4 s) in the
 * way he faces, across a channel that walking cannot cross. A press during a roll does nothing.
 */
export const ROLL = { ticks: 24, travel: metres(3.2) } as const

/** The action in `HeroAction.clip` (0 is none); the figure plays the clip of the same name. */
export const ACTION_CLIP = { roll: 1 } as const
