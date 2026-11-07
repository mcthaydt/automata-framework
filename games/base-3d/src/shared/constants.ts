// The numbers base-3d's sim reads (the free game, DESIGN.md). Positions are Q16.16 metres (`Q16`
// to a metre, the stick mapper's unit); angles are turn units (65,536 to a turn, the heading's unit). The walk and the
// roll are tunables in content/tuning.toml (`tuning.ts`); what is here changes what a tick or a metre means.
import { Q16 } from '@automata/3d/sim'

/** Fixed steps a second: the sim's default, which the page runs at (`defineGame` takes no `tickHz`). */
export const TICK_HZ = 60
/** Metres to Q16.16, rounded to the nearest unit: content is authored in metres. */
export const metres = (value: number): number => Math.round(value * Q16)
/** Half the side of the square Wick collides as, 0.3 m. */
export const HERO_HALF = metres(0.3)
/** How near an ember Wick's centre must come to take it, 0.6 m each way in plan (a square, so no square root). */
export const EMBER_REACH = metres(0.6)

/** The action in `HeroAction.clip` (0 is none); the figure plays the clip of the same name. */
export const ACTION_CLIP = { roll: 1 } as const
