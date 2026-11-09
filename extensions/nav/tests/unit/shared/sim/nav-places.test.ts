import { blockedWith, type Places } from '@automata/places'
import { sectorsPlaces } from '@automata/sectors/sim'
import { stepWith } from '@automata/sectors/testing'
import { createSim, defineComponent, definePlugin, type Sim } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { createNavExtension, navExtension } from '#src/app/nav.extension.ts'
import { createNavPlugin, NavAgent } from '#src/entries/sim.ts'

// Nav reads where a walker stands, and moves it, through `Places`, so a game with no 3D rooms can walk too. The fake here
// is a flat field with no walls: its position is a component of the game's own, not sectors' `InSector`.

const Spot = defineComponent('flat.spot', { x: 'f64', z: 'f64' })
const flat: Places = {
  provider: 'flat',
  at: (ctx, sid) => {
    const e = ctx.entity(sid)
    if (e === undefined || !e.has(Spot)) return undefined
    const { x, z } = e.get(Spot)
    return { x, z }
  },
  move: (ctx, sid, to) => void ctx.entity(sid)?.set(Spot, { x: to.x, z: to.z }),
  spawnAt: (p) => [[Spot, { x: p.x, z: p.z }]],
  rooms: () => [],
  roomAt: () => 0,
  roomOf: () => 0,
  walk: (_, doors) => blockedWith(() => false, doors),
  sight: (_, doors) => blockedWith(() => false, doors),
  crossing: () => null,
}

let sims: Sim[] = []
afterEach(() => {
  for (const sim of sims) sim.dispose()
  sims = []
})

describe('nav over places', () => {
  it('requires and depends on the places provider, not on sectors', () => {
    const extension = createNavExtension({ places: flat })
    expect(extension.requires).toEqual(['flat'])
    expect(extension.sim?.map((plugin) => plugin.dependsOn)).toEqual([['flat']])
  })

  it('stays the 3D default: navExtension requires sectors', () => {
    expect(navExtension.requires).toEqual(['sectors'])
    expect(navExtension.sim?.map((plugin) => plugin.dependsOn)).toEqual([['sectors']])
    expect(createNavExtension({ places: sectorsPlaces }).requires).toEqual(['sectors'])
  })

  it('walks a walker whose position is the game`s own component, and says when it arrives', async () => {
    const sim = await createSim({
      seed: 1,
      plugins: [definePlugin({ name: 'flat', components: [Spot] }), createNavPlugin({ places: flat })],
    })
    sims.push(sim)
    const walker = sim.spawn([
      [Spot, { x: 0, z: 0 }],
      [NavAgent, { speed: 2 }],
    ])
    const events: string[] = []
    for (let tick = 0; tick < 400 && !events.includes('nav.arrived'); tick++) {
      const result = stepWith(
        sim,
        tick === 0 ? [{ type: 'nav.walk-to', payload: { entity: walker, to: { x: 3, z: 4 } } }] : [],
      )
      for (const event of result.events) events.push(event.type)
    }
    expect(events).toContain('nav.arrived')
    const { x, z } = (sim.entity(walker) as NonNullable<ReturnType<Sim['entity']>>).get(Spot)
    expect(x).toBeCloseTo(3, 6)
    expect(z).toBeCloseTo(4, 6)
  })
})
