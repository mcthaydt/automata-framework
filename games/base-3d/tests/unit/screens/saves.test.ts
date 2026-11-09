// base-3d's save through the sim (the save): a new game's sim captures exactly the new game's data, and a
// slot applied to one sim never reaches another's capture (New game captures a fresh sim
// without applying anything, so what an earlier Continue applied must not carry into it).
import { describe, expect, it } from 'vitest'
import { base3dSaves } from '#src/features/screens/saves.ts'
import { Ember } from '#src/shared/ember.component.ts'
import { newGame } from '#src/shared/save.ts'
import { run, startSim } from '#src/testing/sim.ts'

describe('base3dSaves', () => {
  it('captures a new game’s fresh sim as exactly the new game’s data', async () => {
    const sim = await startSim()
    expect(base3dSaves().capture(sim)).toEqual(newGame())
    sim.dispose()
  })

  it('keeps what one slot brought in to that slot’s sim: a later new game starts clean', async () => {
    const saves = base3dSaves()
    const continued = await startSim()
    const played = {
      ...newGame(),
      taken: [0, 3],
      goal: false,
      playTicks: 9000,
      note: 'a later build’s field',
    }
    saves.apply(continued, played)
    expect(saves.capture(continued)).toMatchObject({
      taken: [0, 3],
      playTicks: 9000,
      note: 'a later build’s field',
    })
    continued.dispose()
    const fresh = await startSim()
    expect(saves.capture(fresh)).toEqual(newGame())
    fresh.dispose()
  })

  it('removes the embers a slot says are taken, on the first tick', async () => {
    const saves = base3dSaves()
    const sim = await startSim()
    saves.apply(sim, { ...newGame(), taken: [0, 1, 2] })
    run(sim, {})
    expect(sim.query(Ember).map((entity) => entity.get(Ember).index)).toEqual([3, 4, 5])
    sim.dispose()
  })
})
