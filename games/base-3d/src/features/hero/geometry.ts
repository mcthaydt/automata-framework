// The turn-unit angle math the movement reads. Pure functions, so the systems and the tests share them. Sim code.
import { TURN_UNITS, wrapHeading } from '@automata/3d/sim'
import { atan2 } from '@automata/sim/math'

// 2π spelled out: `Math.PI` is not sim-safe.
const TAU = 6.283185307179586

/** The turn-unit angle of the plan direction `x`, `z` (0 toward +z, growing toward +x), rounded to a unit. */
export const angleOf = (x: number, z: number): number => wrapHeading((atan2(x, z) * TURN_UNITS) / TAU)
