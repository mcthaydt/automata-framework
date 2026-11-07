// The sectors plugin (M6 spec §4.3): the map is a resource set once per scene, each walker's sector is decided on the
// fixed step from the plan position the game writes, and `sector.entered` and `zone.crossed` say when it changes.
import type { Sim } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { createWalkers, load, type Order, spawn, stepWith, walk } from '../testing/walkers'
import { InSector } from './index'

/** West (zone ward) and east (zone hall) rooms joined on x = 4, and a third room `annex`, also zone hall. */
const rooms = {
  sectors: [
    {
      id: 'west',
      zone: 'ward',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [0, 0],
        [4, 0, { next: 'east' }],
        [4, 4],
        [0, 4],
      ],
    },
    {
      id: 'east',
      zone: 'hall',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [4, 0],
        [8, 0, { next: 'annex' }],
        [8, 4],
        [4, 4, { next: 'west' }],
      ],
    },
    {
      id: 'annex',
      zone: 'hall',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [8, 0],
        [12, 0],
        [12, 4],
        [8, 4, { next: 'east' }],
      ],
    },
  ],
} as never
const other = {
  sectors: [
    {
      id: 'yard',
      zone: 'yard',
      floor: 0,
      ceiling: 9,
      light: 1,
      corners: [
        [0, 0],
        [20, 0],
        [20, 20],
        [0, 20],
      ],
    },
  ],
} as never

let sim: Sim | undefined
afterEach(() => sim?.dispose())

const step = (...orders: Order[]) => stepWith(sim as Sim, orders).events

describe('sectorsPlugin', () => {
  it('enters the sector a walker is spawned in, then nothing while it stays', async () => {
    sim = await createWalkers({ rooms })
    step(load('rooms'))
    const events = step(spawn(2, 2))
    const sid = 1
    expect(events.filter((e) => e.type !== 'entity.spawned')).toEqual([
      expect.objectContaining({
        type: 'sector.entered',
        payload: { entity: sid, sector: 'west', from: null },
      }),
      expect.objectContaining({ type: 'zone.crossed', payload: { entity: sid, zone: 'ward', from: null } }),
    ])
    expect(step(walk(sid, 3, 3))).toEqual([])
  })

  it('reports a sector change on the step it happens, and a zone change only when the zone changes', async () => {
    sim = await createWalkers({ rooms })
    step(load('rooms'))
    step(spawn(2, 2))
    const types = (events: ReturnType<typeof step>) => events.map((e) => [e.type, e.payload])
    expect(types(step(walk(1, 6, 2)))).toEqual([
      ['sector.entered', { entity: 1, sector: 'east', from: 'west' }],
      ['zone.crossed', { entity: 1, zone: 'hall', from: 'ward' }],
    ])
    expect(types(step(walk(1, 10, 2)))).toEqual([
      ['sector.entered', { entity: 1, sector: 'annex', from: 'east' }],
    ])
    expect(types(step(walk(1, 50, 2)))).toEqual([])
    expect(types(step(walk(1, 10, 2)))).toEqual([
      ['sector.entered', { entity: 1, sector: 'annex', from: null }],
      ['zone.crossed', { entity: 1, zone: 'hall', from: null }],
    ])
  })

  it('keeps InSector’s sector in step with the position: index + 1, 0 outside', async () => {
    sim = await createWalkers({ rooms })
    step(load('rooms'))
    step(spawn(6, 2))
    const sector = () => (sim as Sim).entity(1)?.get(InSector).sector
    expect(sector()).toBe(2)
    step(walk(1, 50, 2))
    expect(sector()).toBe(0)
  })

  it('re-derives every walker’s sector from a new scene’s map', async () => {
    sim = await createWalkers({ rooms, other })
    step(load('rooms'))
    step(spawn(2, 2))
    expect(step(load('other')).map((e) => [e.type, e.payload])).toEqual([
      ['sector.entered', { entity: 1, sector: 'yard', from: null }],
      ['zone.crossed', { entity: 1, zone: 'yard', from: null }],
    ])
  })

  it('restores mid-way to the same membership and events', async () => {
    const run = async (restoreAt?: number) => {
      let current = await createWalkers({ rooms })
      const script = [[load('rooms')], [spawn(2, 2)], [walk(1, 6, 2)], [walk(1, 10, 2)], [walk(1, 2, 2)]]
      const out: unknown[] = []
      for (const [tick, commands] of script.entries()) {
        if (tick === restoreAt) {
          const bytes = current.snapshot()
          current.dispose()
          current = await createWalkers({ rooms })
          current.restore(bytes)
        }
        out.push(stepWith(current, commands).events.map((e) => [e.type, e.payload]))
      }
      const hash = current.hash()
      current.dispose()
      return { out, hash }
    }
    expect(await run(3)).toEqual(await run())
  })
})
