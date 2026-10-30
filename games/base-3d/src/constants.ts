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
/** Each action's code in `HeroAction.clip` (0 is none); the figure plays the clip of the same name (M3 spec §4.7). */
export const ACTION_CLIP = { slash: 1, point: 2, pickup: 3 } as const
/** Each action's length in ticks at 60 Hz: its clip's `length` (0.4 s, 0.8 s, 0.9 s), which the content test checks. */
export const ACTION_TICKS = { slash: 24, point: 48, pickup: 54 } as const
/** Each action button's bit in `HeroControl.actHeld` and `actPressed`. */
export const ACTION_BITS = { slash: 1, guard: 2, point: 4, pickup: 8 } as const
