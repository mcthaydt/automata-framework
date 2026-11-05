import { createSim, type Sim } from '@mcthaydt/automata-sim'
import { afterEach, describe, expect, it } from 'vitest'
import { Body, Pulse, WORLD } from '../../../../stress/sim/stress.component.ts'
import { spawnStress, stressPlugin } from '../../../../stress/sim/stress.plugin.ts'

const sims: Sim[] = []
async function stressSim(entities: number, systems: number, seed = 7): Promise<Sim> {
  const sim = await createSim({ seed, plugins: [stressPlugin(systems)] })
  sims.push(sim)
  spawnStress(sim, entities, seed)
  return sim
}

afterEach(() => {
  for (const sim of sims.splice(0)) sim.dispose()
})

describe('the stress sim (N entities, M systems)', () => {
  it('registers M systems with distinct names: one mover and M - 1 workers', () => {
    const names = stressPlugin(5).systems.map((system) => system.name)
    expect(names).toEqual(['stress.move', 'stress.work-1', 'stress.work-2', 'stress.work-3', 'stress.work-4'])
    expect(() => stressPlugin(0)).toThrow('at least one system')
  })

  it('spawns N entities that move and stay inside the world', async () => {
    const sim = await stressSim(200, 4)
    expect(sim.query(Body, Pulse)).toHaveLength(200)
    const before = sim.query(Body).map((entity) => ({ ...entity.get(Body) }))
    for (let tick = 0; tick < 300; tick += 1) sim.step([])
    const after = sim.query(Body).map((entity) => entity.get(Body))
    expect(after).not.toEqual(before)
    for (const body of after) {
      expect(body.x).toBeGreaterThanOrEqual(0)
      expect(body.x).toBeLessThan(WORLD.width * WORLD.sub)
      expect(body.y).toBeGreaterThanOrEqual(0)
      expect(body.y).toBeLessThan(WORLD.height * WORLD.sub)
    }
  })

  it('runs every worker each tick: the pulse changes with M', async () => {
    const one = await stressSim(10, 1)
    const three = await stressSim(10, 3)
    one.step([])
    three.step([])
    expect(one.query(Pulse)[0]?.get(Pulse).phase).toBe(0)
    expect(three.query(Pulse)[0]?.get(Pulse).phase).not.toBe(0)
  })

  it('is deterministic: two sims with one seed hash the same after 60 ticks', async () => {
    const a = await stressSim(100, 6)
    const b = await stressSim(100, 6)
    for (let tick = 0; tick < 60; tick += 1) {
      a.step([])
      b.step([])
    }
    expect(a.hash()).toBe(b.hash())
  })
})
