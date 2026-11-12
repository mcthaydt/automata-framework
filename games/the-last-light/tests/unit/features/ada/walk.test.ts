import { InteractUsed } from '@automata/interact/sim'
import { NavRoutes } from '@automata/nav/sim'
import { InSector } from '@automata/sectors/sim'
import { SystemsEnv } from '@automata/systems/sim'
import { describe, expect, it } from 'vitest'
import { Ada } from '#src/shared/ada.component.ts'
import { boot } from '#src/testing/harness.ts'

// Ada walks the way the stick points, seen from the camera, stopped by the walls; a tap walks her to a hotspot and uses it;
// a push of the hand wins over a tap's route.

const UP = { x: 0, y: -127 }

describe('Ada walking', () => {
  it('starts on the level’s spawn', async () => {
    const game = await boot()
    expect(game.ada()).toMatchObject({ x: 0.6, z: 3.6 })
  })

  it('walks about 1.5 m in half a second at the tuned speed (3 m/s), in the way the camera faces', async () => {
    const game = await boot()
    const from = game.ada()
    game.hold(0.5, UP)
    const to = game.ada()
    expect(Math.hypot(to.x - from.x, to.z - from.z)).toBeCloseTo(1.5, 1)
  })

  it('is stopped by the walls: ten seconds into the south wall leaves her inside the hall', async () => {
    const game = await boot()
    game.hold(10, { x: 0, y: -127 })
    game.hold(10, { x: 0, y: 127 })
    for (const stick of [
      { x: 127, y: 0 },
      { x: -127, y: 0 },
    ]) {
      game.hold(10, stick)
      const at = game.ada()
      expect(Math.abs(at.x)).toBeLessThanOrEqual(5.2)
      expect(at.z).toBeLessThanOrEqual(6.9)
    }
  })

  it('walks to a hotspot a tap names, and uses it when she is in reach', async () => {
    const game = await boot()
    game.tap('record', { seconds: 5 })
    expect(game.events(InteractUsed)).toContainEqual(expect.objectContaining({ at: 'record' }))
  })

  it('forgets a tap’s route when the hand pushes', async () => {
    const game = await boot()
    game.tap('bed', { seconds: 0.2 })
    expect(Object.keys(game.sim.resource(NavRoutes))).toHaveLength(1)
    game.hold(0.1, UP)
    expect(Object.keys(game.sim.resource(NavRoutes))).toHaveLength(0)
  })

  it('gives the same place twice, from the same seed', async () => {
    const run = async () => {
      const game = await boot(1)
      game.hold(2, UP)
      game.tap('record', { seconds: 4 })
      return game.sim.hash()
    }
    expect(await run()).toBe(await run())
  })
})

describe('Ada standing', () => {
  it('is not walking, and the creature is told she is still', async () => {
    const game = await boot()
    game.hold(1)
    const [ada] = game.sim.query(Ada)
    expect(ada?.get(Ada).walking).toBe(false)
    expect(game.sim.resource(SystemsEnv).moving).toBe(false)
  })

  it('is walking while she moves', async () => {
    const game = await boot()
    game.hold(0.5, UP)
    expect(game.sim.query(Ada)[0]?.get(Ada).walking).toBe(true)
    expect(game.sim.resource(SystemsEnv).moving).toBe(true)
  })
})

describe('Ada in a cutscene', () => {
  it('does not walk while a cutscene holds the input, and walks again when it ends', async () => {
    const game = await boot(1, undefined, { opening: true })
    const from = game.ada()
    game.hold(1, UP)
    expect(game.ada()).toEqual(from)
    game.send([{ type: 'cutscene.skip', payload: {} }])
    game.hold(1, UP)
    expect(game.ada()).not.toEqual(from)
  })
})

describe('Ada and the furniture', () => {
  it('cannot walk through the bench: pushed west along the bottom of the hall she stops before it', async () => {
    const game = await boot()
    game.hold(10, { x: -127, y: 0 })
    // The bench stands from x -3.65 to -2.05 at z 3.05 to 3.51; she starts at z 3.6, its width from it within her radius.
    expect(game.ada().x).toBeGreaterThan(-2.05)
  })

  it('cannot walk through the reception desk: pushed east from the spawn she stops before the counter’s wing', async () => {
    const game = await boot()
    game.hold(1, { x: 0, y: -127 })
    game.hold(10, { x: 127, y: 0 })
    expect(game.ada().x).toBeLessThan(2.55)
  })

  it('is stopped by the bed on her way to the ward', async () => {
    const game = await boot()
    const sim = game.sim
    const sid = sim.query(Ada)[0]?.sid as number
    // Standing east of the bed (x -3.55) at its middle, pushed west into it.
    sim.entity(sid)?.set(InSector, { x: -3.0, z: 0.4 })
    game.hold(5, { x: -127, y: 0 })
    expect(game.ada().x).toBeGreaterThan(-3.55)
  })
})
