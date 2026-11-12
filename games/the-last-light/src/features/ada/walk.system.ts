import { CameraHeading, moveDirection, Q16 } from '@automata/3d/sim'
import { NavDoors, NavRoutes } from '@automata/nav/sim'
import { blockedBy, InSector, resolvedMap } from '@automata/sectors/sim'
import { defineSystem, type SimContext, type SystemDef } from '@automata/sim'
import { atan2 } from '@automata/sim/math'
import { SystemsEnv } from '@automata/systems/sim'
import { Ada } from '../../shared/ada.component.ts'
import { TICK_HZ } from '../../shared/constants.ts'
import { playIn } from '../../shared/play-content.ts'
import { Move } from './move.command.ts'

/** How near a wall her centre may come, in metres (about half her shoulders). */
export const ADA_RADIUS = 0.2

/**
 * Walks Ada the way the stick points, seen from the camera, at the walking speed scaled by how far the stick is pushed. The
 * walls and the doors the walk keeps stop her; pushed into a wall at an angle she slides along it. A push drops any route
 * she was walking (a tap's), so the hand always wins over a pending use.
 */
export const walk = (locked: (ctx: SimContext) => boolean): SystemDef =>
  defineSystem({
    name: 'ada.walk',
    phase: 'gameplay',
    before: ['nav.walk'],
    run: (ctx) => {
      const { tuning } = playIn(ctx.content)
      const moves = ctx.commands.of(Move)
      // A cutscene holds the input: the stick does nothing until it ends.
      const stick = locked(ctx) ? { x: 0, y: 0 } : (moves[moves.length - 1]?.payload ?? { x: 0, y: 0 })
      const step = tuning.WALK_SPEED / TICK_HZ
      const walls = blockedBy(resolvedMap(ctx), ctx.resource(NavDoors).open)
      for (const ada of ctx.query(Ada, CameraHeading, InSector)) {
        const mapped = moveDirection(ada.get(CameraHeading), stick)
        ada.set(CameraHeading, mapped.state)
        if (mapped.direction.x === 0 && mapped.direction.z === 0) continue
        // A push is the hand taking over: a route a tap made is forgotten.
        delete ctx.resource(NavRoutes)[String(ada.sid)]
        const here = ada.get(InSector)
        const dx = (mapped.direction.x / Q16) * step
        const dz = (mapped.direction.z / Q16) * step
        // One axis at a time, so a push into a wall at an angle slides along it instead of stopping.
        const x = walls.segment(here, { x: here.x + dx, z: here.z }, ADA_RADIUS) ? here.x : here.x + dx
        const z = walls.segment({ x, z: here.z }, { x, z: here.z + dz }, ADA_RADIUS) ? here.z : here.z + dz
        ada.set(InSector, { x, z })
      }
    },
  })

/**
 * After every way she can move (the stick, a tap's route): she faces where she went, is walking if she moved, and the
 * creature learns whether she is moving (a still player is harder to notice). The step in which a walk arrives does not
 * count: the walk is over, so a hiding place she has just reached is not given up by the step that brought her to it.
 */
export const face = defineSystem({
  name: 'ada.face',
  phase: 'gameplay',
  // After the use of a hotspot is settled (a walk that has arrived is dropped there) and before the creature's step.
  after: ['nav.walk', 'interact.run'],
  before: ['systems.step'],
  run: (ctx) => {
    for (const ada of ctx.query(Ada, InSector)) {
      const here = ada.get(InSector)
      const before = ada.get(Ada)
      const dx = here.x - before.lastX
      const dz = here.z - before.lastZ
      const moved = dx !== 0 || dz !== 0
      ada.set(Ada, {
        yaw: moved ? atan2(dx, dz) : before.yaw,
        walking: moved,
        lastX: here.x,
        lastZ: here.z,
      })
      const stick = ctx.commands.of(Move).some(({ payload }) => payload.x !== 0 || payload.y !== 0)
      const routed = ctx.resource(NavRoutes)[String(ada.sid)] !== undefined
      ctx.resource(SystemsEnv).moving = moved && (stick || routed)
    }
  },
})
