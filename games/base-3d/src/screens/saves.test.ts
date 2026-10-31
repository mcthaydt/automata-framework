// base-3d's save through the sim (DESIGN.md §12.1): a new game's sim captures exactly the new game's data, and a
// slot applied to one sim never reaches another's capture (the 1e part 5a follow-up: New game captures a fresh sim
// without applying anything, so what an earlier Continue applied must not carry into it).
import { describe, expect, it } from 'vitest'
import { newGame } from '../state/save.ts'
import { startSim } from '../testing/sim.ts'
import { base3dSaves } from './saves.ts'

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
      hearts: { max: 5, pieces: ['hub-well'] },
      flags: ['met-lamplighter'],
      kiln: { ...newGame().kiln, smallKeys: 1, visited: ['hall'] },
      resume: 'kiln' as const,
      playTicks: 9000,
    }
    saves.apply(continued, played)
    expect(saves.capture(continued)).toMatchObject({ flags: ['met-lamplighter'], playTicks: 9000 })
    continued.dispose()
    const fresh = await startSim()
    expect(saves.capture(fresh)).toEqual(newGame())
    fresh.dispose()
  })
})
