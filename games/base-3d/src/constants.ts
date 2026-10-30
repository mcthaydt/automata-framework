// The numbers base-3d's sim reads (DESIGN.md §3.1). Positions are Q16.16 metres (`Q16` to a metre, the stick
// mapper's unit); angles are turn units (65,536 to a turn, the heading's unit). They become tunables in
// content/tuning.toml with GAME-3D.1k.
import { Q16 } from '@mcthaydt/automata-render-pixi3d/sim'

/** Fixed steps a second. */
export const TICK_HZ = 60
/** Metres to Q16.16, rounded to the nearest unit: content is authored in metres. */
export const metres = (value: number): number => Math.round(value * Q16)
/** Wick's walk at a full push, 4 m/s, in Q16.16 metres a tick: round(4 / 60 × 65,536). */
export const WALK_PER_TICK = 4_369
/** Half the side of the square Wick collides as, 0.3 m (his hurt radius, DESIGN.md §7.3). */
export const HERO_HALF = metres(0.3)
/** How far the lock reaches in plan, 12 m (DESIGN.md §11.1). */
export const LOCK_RANGE = metres(12)
