// The items' numbers (DESIGN.md §9.1, §9.2): starting values that become tunables with GAME-3D.1k (§17), as the other
// constants are. Positions are Q16.16 metres, angles turn units, as in index.ts.
import { type MoveDef, metres, TICK_HZ } from './index.ts'

/** A shot flies level at this height when it has nothing to rise to (§9.2: chest height). */
export const CHEST_HEIGHT = metres(1.2)
/** The aim picks a foe whose bearing lies within this many turn units of the aim line: ±6° (§9.2). */
export const AIM_HALF_ANGLE = Math.round((6 * 65_536) / 360)

/** The Spark Sling (§9.1): held this many ticks to draw, then a pellet at 20 m/s for at most 15 m, 30 at most. */
export const SLING = {
  draw: 8,
  step: Math.round(metres(20) / TICK_HZ),
  range: metres(15),
  maxPellets: 30,
} as const

/** Each item's code in `Inventory.equipped` (0 none). */
export const ItemCode = { sling: 1, bombs: 2, hookchain: 3 } as const

/**
 * The moves items make (§9.1), in the world's move table after the enemies'. A pellet in flight plays `sling-pellet`
 * on every tick: one active frame reaching one tick's flight ahead, at the height it flies at (`pellet.y`, not the
 * band here). Its hit is a pellet's (it drops a Wisp and opens the Warden's mouth) and stuns 60 ticks (a Sootling,
 * §9.1).
 */
export const ITEM_MOVES: readonly MoveDef[] = [
  {
    id: 'sling-pellet',
    total: 1,
    active: [1, 1],
    hit: {
      near: 0,
      far: SLING.step,
      bottom: 0,
      top: 0,
      dmg: 1,
      stop: 2,
      stun: 60,
      kb: 0,
      power: 1,
      pellet: true,
    },
  },
]
