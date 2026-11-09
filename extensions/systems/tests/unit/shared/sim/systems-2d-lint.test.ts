import { describe, expect, it } from 'vitest'
import type { AgentDef } from '#src/entries/sim.ts'
import { systemsWarnings } from '#src/entries/sim.ts'
import { sceneOf, watchman } from '#src/testing/toy.ts'

// Warnings for a systems file in a 2D game. A 2D level has no lamps, so a `light` sense only notices what the game's own
// code says is lit; the file is still valid, so these are warnings and `checkSystems` stays quiet.

const NO_LAMPS =
  '2D levels have no lamps, so this sense never notices anything unless the game’s code says how bright it is.'
const sneak = (): AgentDef => ({ ...watchman(), id: 'sneak', senses: [{ light: { radius: 3 } }] })
const lit = (): AgentDef => ({
  ...watchman(),
  id: 'lit',
  transitions: [{ from: 'patrol', to: 'hunt', when: [{ inLight: true }], priority: 1 }],
})

describe('systemsWarnings', () => {
  it('says a light sense does nothing in a 2D game whose code gives no derived fact', () => {
    const found = systemsWarnings(sceneOf(sneak()), { flat: true, derived: [] })
    expect(found).toEqual([{ path: ['agents', 0, 'senses', 0], message: `agent sneak: ${NO_LAMPS}` }])
  })

  it('says it of an inLight question too', () => {
    const found = systemsWarnings(sceneOf(lit()), { flat: true, derived: [] })
    expect(found.map((each) => each.message)).toEqual([`agent lit: ${NO_LAMPS}`])
  })

  it('says nothing when the game’s code supplies a derived fact, or in a 3D game, or with no light at all', () => {
    expect(systemsWarnings(sceneOf(sneak()), { flat: true, derived: ['self.lit'] })).toEqual([])
    expect(systemsWarnings(sceneOf(sneak()), { derived: [] })).toEqual([])
    expect(systemsWarnings(sceneOf(watchman()), { flat: true, derived: [] })).toEqual([])
  })
})
