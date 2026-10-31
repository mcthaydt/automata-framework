// The HUD's state from the running sim (DESIGN.md §9.5, GAME-3D.1e part 5a): hearts in half steps, embers, the
// equipped item and its ammo, and the boss bar while a Warden lives.
import { describe, expect, it } from 'vitest'
import { Fighter } from '../components.ts'
import { newGame } from '../state/save.ts'
import { startFoes, wickSid } from '../testing/foes.ts'
import { startSim } from '../testing/sim.ts'
import { heartsOf, hudOf } from './hud.ts'
import { base3dSaves } from './saves.ts'

describe('heartsOf', () => {
  it('gives one heart for every two half-hearts, in half steps', () => {
    expect(heartsOf(7, 10)).toEqual(['full', 'full', 'full', 'half', 'empty'])
    expect(heartsOf(8, 8)).toEqual(['full', 'full', 'full', 'full'])
    expect(heartsOf(0, 6)).toEqual(['empty', 'empty', 'empty'])
  })

  it('rounds an odd maximum up to a whole heart and never shows more than the maximum', () => {
    expect(heartsOf(12, 7)).toEqual(['full', 'full', 'full', 'half'])
    expect(heartsOf(-1, 2)).toEqual(['empty'])
  })
})

describe('hudOf', () => {
  it('reads a new game: 4 hearts full, no embers, nothing equipped and no boss', async () => {
    const sim = await startSim()
    expect(hudOf(sim)).toEqual({ health: 8, maxHealth: 8, embers: 0, equipped: undefined, boss: undefined })
    sim.dispose()
  })

  it('shows the equipped item with its ammo, and Wick’s health as it falls', async () => {
    const sim = await startSim()
    base3dSaves().apply(sim, {
      ...newGame(),
      embers: 37,
      items: { sling: true, bombs: true, hookchain: true },
      ammo: { pellets: 12, bombs: 3 },
      equipped: 'sling',
    })
    expect(hudOf(sim)).toMatchObject({ embers: 37, equipped: { item: 'sling', ammo: 12 } })
    base3dSaves().apply(sim, {
      ...newGame(),
      items: { sling: true, bombs: true, hookchain: true },
      ammo: { pellets: 0, bombs: 3 },
      equipped: 'bombs',
    })
    expect(hudOf(sim)?.equipped).toEqual({ item: 'bombs', ammo: 3 })
    base3dSaves().apply(sim, {
      ...newGame(),
      items: { sling: false, bombs: false, hookchain: true },
      equipped: 'hookchain',
    })
    expect(hudOf(sim)?.equipped).toEqual({ item: 'hookchain' })
    sim.entity(wickSid(sim))?.set(Fighter, { health: 5 })
    expect(hudOf(sim)).toMatchObject({ health: 5, maxHealth: 8 })
    sim.dispose()
  })

  it('shows the boss bar while a Warden lives, with its id and health of 24', async () => {
    const sim = await startFoes([{ kind: 'warden', x: 0, z: 8, facing: 180 }])
    expect(hudOf(sim)?.boss).toEqual({ id: 'warden', health: 24, max: 24 })
    const [warden] = sim.query(Fighter).filter((entity) => entity.sid !== wickSid(sim))
    warden?.set(Fighter, { health: 9 })
    expect(hudOf(sim)?.boss).toEqual({ id: 'warden', health: 9, max: 24 })
    warden?.set(Fighter, { health: 0 })
    expect(hudOf(sim)?.boss).toBeUndefined()
    sim.dispose()
  })

  it('reads nothing without a running sim', () => {
    expect(hudOf(undefined)).toBeUndefined()
  })
})
