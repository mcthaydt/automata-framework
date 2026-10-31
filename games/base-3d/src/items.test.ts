import type { Sim } from '@mcthaydt/automata-sim'
import { describe, expect, it } from 'vitest'
import { Pellet } from './components.ts'
import { CombatState, metres } from './constants/index.ts'
import { ItemCode, SLING } from './constants/items.ts'
import { Inventory } from './resources.ts'
import { base3dSaves } from './screens/saves.ts'
import { newGame } from './state/save.ts'
import { type AreaSource, compileArea } from './systems/index.ts'
import { fighter, foes } from './testing/foes.ts'
import { run, startSim, type TickInput } from './testing/sim.ts'

// base-3d's items (GAME-3D.1e, DESIGN.md §9): the sling's draw, its pellets' flight and what they hit, the ammo and the
// inventory through the save. The browsers project runs this file in Chromium, WebKit and Firefox too.

/** Wick at the origin facing +z, with `foes` and `walls`, the sling owned and equipped with `pellets`. */
async function slingArea(foesIn: AreaSource['foes'] = [], walls: AreaSource['walls'] = [], pellets = 10) {
  const sim = await startSim(
    compileArea({
      id: 'range',
      spawn: { x: 0, z: 0 },
      views: [{ id: 'open', yawDeg: 0 }],
      rooms: [{ view: 'open', min: [-30, -30], max: [30, 30] }],
      walls,
      targets: [],
      ember: { x: 29, z: 29 },
      foes: foesIn,
    }),
  )
  Object.assign(sim.resource(Inventory), { sling: true, equipped: ItemCode.sling, pellets })
  return sim
}

const ITEM: TickInput = { act: { item: true } }
/** Holds Item `ticks` ticks, then lets go: the events of the whole draw and release, as types. */
function shoot(sim: Sim, ticks: number = SLING.draw): string[] {
  const events = run(sim, ITEM, ticks)
  events.push(...run(sim, {}))
  return events.map((event) => event.split('@')[0] as string)
}
const pellets = (sim: Sim) => sim.query(Pellet)

describe('the Spark Sling (DESIGN.md §9.1)', () => {
  it('fires when Item is let go after a draw of 8 ticks, spending a pellet, and not after 7', async () => {
    const sim = await slingArea()
    expect(shoot(sim, SLING.draw - 1)).not.toContain('shot.fired')
    expect(pellets(sim)).toHaveLength(0)
    expect(shoot(sim)).toContain('shot.fired')
    expect(pellets(sim)).toHaveLength(1)
    expect(sim.resource(Inventory).pellets).toBe(9)
    sim.dispose()
  })

  it('fires nothing with no pellets, or with the sling unowned or not equipped', async () => {
    for (const inventory of [{ pellets: 0 }, { sling: false }, { equipped: 0 }]) {
      const sim = await slingArea()
      Object.assign(sim.resource(Inventory), inventory)
      expect(shoot(sim)).not.toContain('shot.fired')
      expect(pellets(sim)).toHaveLength(0)
      sim.dispose()
    }
  })

  it('flies 20 m/s along the aim at chest height, and is gone after 15 m', async () => {
    const sim = await slingArea()
    shoot(sim)
    const [pellet] = pellets(sim)
    const first = pellet?.get(Pellet)
    expect(first).toMatchObject({ x: 0, z: 0, y: metres(1.2), facing: 0 })
    run(sim, {})
    expect(sim.entity(pellet?.sid as number)?.get(Pellet)?.z).toBe(SLING.step)
    // Its segments reach at most one tick's flight past 15 m, and then it is gone.
    let farthest = 0
    for (let i = 0; i < 60 && pellets(sim).length > 0; i++) {
      farthest = Math.max(farthest, pellets(sim)[0]?.get(Pellet)?.z ?? 0)
      run(sim, {})
    }
    expect(pellets(sim)).toHaveLength(0)
    expect(farthest).toBeGreaterThanOrEqual(SLING.range - SLING.step)
    expect(farthest).toBeLessThanOrEqual(SLING.range)
    sim.dispose()
  })

  it('stops at a wall', async () => {
    const sim = await slingArea([], [{ min: [-2, 3], max: [2, 3.2] }])
    shoot(sim)
    run(sim, {}, 12)
    expect(pellets(sim)).toHaveLength(0)
    sim.dispose()
  })

  it('stuns a Sootling 60 ticks', async () => {
    const sim = await slingArea([{ kind: 'sootling', x: 0, z: 4, facing: 180 }])
    const [sootling] = foes(sim).map((entity) => entity.sid) as [number]
    const events = shoot(sim)
    for (let i = 0; i < 20 && !events.includes('hit.landed'); i++)
      events.push(...run(sim, {}).map((e) => e.split('@')[0] as string))
    expect(events).toContain('hit.landed')
    expect(fighter(sim, sootling)).toMatchObject({ health: 1, state: CombatState.stun, stun: 60 })
    expect(pellets(sim)).toHaveLength(0)
    sim.dispose()
  })

  it('rises to a hovering Wisp ahead and drops it to the floor (§9.2, §8.2)', async () => {
    const sim = await slingArea([{ kind: 'wisp', x: 0.4, z: 6, facing: 180 }])
    const [wisp] = foes(sim).map((entity) => entity.sid) as [number]
    shoot(sim)
    expect(pellets(sim)[0]?.get(Pellet)?.y).toBe(metres(2.2) + metres(0.4))
    run(sim, {}, 25)
    expect(fighter(sim, wisp)).toMatchObject({ lift: 0 })
    sim.dispose()
  })

  it('turns Wick to the aim when he fires: toward his locked target', async () => {
    const sim = await slingArea([{ kind: 'ash-knight', x: 4, z: 4, facing: 225 }])
    run(sim, { lock: true, act: { item: true } }, SLING.draw)
    run(sim, { lock: true })
    expect(pellets(sim)[0]?.get(Pellet)?.facing).toBe(8_192)
    sim.dispose()
  })
})

describe('the inventory through the save (DESIGN.md §12.1)', () => {
  it('applies the items, ammo and equipped item before tick 0, and captures them back', async () => {
    const sim = await slingArea([], [], 0)
    const saves = base3dSaves()
    const data = {
      ...newGame(),
      items: { sling: true, bombs: true, hookchain: false },
      ammo: { pellets: 12, bombs: 3 },
      equipped: 'sling' as const,
    }
    saves.apply(sim, data)
    expect(sim.resource(Inventory)).toMatchObject({
      sling: true,
      bombs: true,
      hookchain: false,
      equipped: ItemCode.sling,
      pellets: 12,
      bombAmmo: 3,
    })
    shoot(sim)
    expect(saves.capture(sim)).toMatchObject({
      ammo: { pellets: 11, bombs: 3 },
      equipped: 'sling',
      items: data.items,
    })
    sim.dispose()
  })
})
