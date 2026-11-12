import { CameraHeading, CameraYaw } from '@automata/3d/sim'
import { InSector } from '@automata/sectors/sim'
import { describe, expect, it } from 'vitest'
import { Move } from '#src/features/ada/move.command.ts'
import { Ada } from '#src/shared/ada.component.ts'
import { boot, type Game } from '#src/testing/harness.ts'

// The camera turns freely (`camera-yaw`, the Owner's right stick, swipe and mouse), and its heading is sim state, because the stick
// walks Ada relative to the camera: pushed up, she walks away from it, whatever way it has been turned. The same turns and pushes
// give the same night: the same place, the same heading, the same hash.

const headingOf = (game: Game): number =>
  game.sim.query(Ada, CameraHeading)[0]?.get(CameraHeading).heading ?? -1
const placeOf = (game: Game): { x: number; z: number } => {
  const at = game.sim.query(Ada, InSector)[0]?.get(InSector)
  if (at === undefined) throw new Error('no Ada')
  return { x: at.x, z: at.z }
}

/** Turns the camera `units` a tick for `ticks`, then walks with the stick up for `walk` ticks. */
function turnThenWalk(game: Game, units: number, ticks: number, walk: number): void {
  for (let tick = 0; tick < ticks; tick++) game.send([{ type: CameraYaw.id, payload: { units } }])
  for (let tick = 0; tick < walk; tick++) game.send([{ type: Move.id, payload: { x: 0, y: -127 } }])
}

describe('the free camera in the game’s sim', () => {
  it('turns the heading by camera-yaw, smoothly, and the stick walks her away from the camera at the new heading', async () => {
    const game = await boot()
    const before = headingOf(game)
    const start = placeOf(game)
    // A quarter turn, 455 units a tick (the right stick at full push), less than one 45-degree step a tick.
    turnThenWalk(game, 455, 36, 0)
    const heading = headingOf(game)
    expect((heading - before + 65_536) % 65_536).toBe(455 * 36)
    turnThenWalk(game, 0, 0, 20)
    const end = placeOf(game)
    // The camera's forward is (sin h, cos h): she walked along it, away from the camera.
    const h = (heading / 65_536) * 2 * Math.PI
    const dx = end.x - start.x
    const dz = end.z - start.z
    expect(dx * Math.sin(h) + dz * Math.cos(h)).toBeGreaterThan(0.3)
    expect(Math.abs(dx * Math.cos(h) - dz * Math.sin(h))).toBeLessThan(0.05)
  })

  it('gives the same hash for the same turns and pushes, and another for another turn', async () => {
    const a = await boot()
    const b = await boot()
    const c = await boot()
    turnThenWalk(a, 455, 20, 30)
    turnThenWalk(b, 455, 20, 30)
    turnThenWalk(c, 455, 21, 30)
    expect(a.sim.hash()).toBe(b.sim.hash())
    expect(c.sim.hash()).not.toBe(a.sim.hash())
  })
})
