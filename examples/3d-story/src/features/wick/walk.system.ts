import { CameraHeading, moveDirection, Q16 } from '@automata/3d/sim'
import { InSector } from '@automata/sectors/sim'
import { defineSystem } from '@automata/sim'
import { atan2 } from '@automata/sim/math'
import { SystemsEnv } from '@automata/systems/sim'
import { TICK_HZ, WICK_HALF } from '../../shared/constants.ts'
import { playIn, standsAt } from '../room/read-room.ts'
import { Move } from './move.command.ts'
import { Wick } from './wick.component.ts'

/**
 * Walks Wick the way the stick points, seen from the camera, at the walking speed scaled by how far the stick is
 * pushed. He faces the way he goes. Walls and props stop him. Only the sim changes the game, so a replay ends where
 * play did.
 */
export const walk = defineSystem('walk', (ctx) => {
  const { room, tuning } = playIn(ctx.content)
  const moves = ctx.commands.of(Move)
  const stick = moves[moves.length - 1]?.payload ?? { x: 0, y: 0 }
  const step = tuning.WALK_SPEED / TICK_HZ
  for (const wick of ctx.query(Wick, CameraHeading)) {
    const mapped = moveDirection(wick.get(CameraHeading), stick)
    wick.set(CameraHeading, mapped.state)
    const here = wick.get(Wick)
    const dx = (mapped.direction.x / Q16) * step
    const dz = (mapped.direction.z / Q16) * step
    // One axis at a time, so Wick pushed into a wall at an angle slides along it instead of stopping.
    const x = standsAt(room, here.x + dx, here.z, WICK_HALF) ? here.x + dx : here.x
    const z = standsAt(room, x, here.z + dz, WICK_HALF) ? here.z + dz : here.z
    const pushing = dx !== 0 || dz !== 0
    wick.set(Wick, {
      x,
      z,
      yaw: pushing ? atan2(dx, dz) : here.yaw,
      walking: x !== here.x || z !== here.z,
    })
    // The characters sense Wick where he is on the floor plan, and notice whether he moves.
    wick.set(InSector, { x, z })
    ctx.resource(SystemsEnv).moving = x !== here.x || z !== here.z
  }
})
