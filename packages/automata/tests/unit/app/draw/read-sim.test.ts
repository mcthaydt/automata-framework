import {
  createSim,
  defineComponent,
  definePlugin,
  defineResource,
  defineSystem,
  type Sim,
} from '@mcthaydt/automata-sim'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { readSim } from '#src/app/draw/read-sim.ts'

const Body = defineComponent('body', { x: 'f32', y: 'f32' })
const Tag = defineComponent('tag', { n: 'i32' })
const Score = defineResource('score', z.object({ points: z.number(), names: z.array(z.string()) }), () => ({
  points: 0,
  names: ['a'],
}))
const drift = defineSystem('drift', (ctx) => {
  for (const body of ctx.query(Body)) body.set(Body, { x: body.get(Body).x + 1 })
})
const plugin = definePlugin({ name: 'reads', defs: [Body, Tag, Score, drift] })

let sim: Sim | undefined
async function twoBodies(): Promise<Sim> {
  sim = await createSim({ plugins: [plugin], seed: 1 })
  sim.spawn([[Body, { x: 1, y: 2 }]])
  sim.spawn([[Body, { x: 3, y: 4 }], Tag])
  sim.step([])
  return sim
}

afterEach(() => {
  sim?.dispose()
  sim = undefined
})

// The draw layer's view of the sim (PRODUCT spec §7, plan D-3): it reads, and nothing it hands out can write.
describe('readSim', () => {
  it('reads the tick, queries, entities and resources the sim holds', async () => {
    const live = await twoBodies()
    const view = readSim(live)

    expect(view.tick).toBe(live.tick)
    expect(view.query(Body).map((entity) => entity.get(Body))).toEqual([
      { x: 2, y: 2 },
      { x: 4, y: 4 },
    ])
    const tagged = view.query(Tag)
    expect(tagged).toHaveLength(1)
    const sid = tagged[0]?.sid ?? -1
    expect(view.entity(sid)?.has(Body)).toBe(true)
    expect(view.entity(9999)).toBeUndefined()
    expect(view.resource(Score)).toEqual({ points: 0, names: ['a'] })

    live.step([])
    expect(view.tick).toBe(live.tick)
  })

  it('hands out frozen copies, so an assignment throws', async () => {
    const view = readSim(await twoBodies())
    const body = view.query(Body)[0]?.get(Body) as { x: number }
    expect(() => {
      body.x = 99
    }).toThrow(TypeError)
    const score = view.resource(Score) as { points: number; names: string[] }
    expect(() => {
      score.points = 5
    }).toThrow(TypeError)
    expect(() => score.names.push('b')).toThrow(TypeError)
  })

  it('has no way to change the sim', async () => {
    const live = await twoBodies()
    const view = readSim(live) as unknown as Record<string, unknown>
    for (const write of ['step', 'spawn', 'restore', 'dispose', 'snapshot'])
      expect(view[write], write).toBeUndefined()
    const entity = readSim(live).query(Body)[0] as unknown as Record<string, unknown>
    for (const write of ['set', 'add', 'remove']) expect(entity[write], write).toBeUndefined()
    expect(() => {
      ;(view as { tick: number }).tick = 0
    }).toThrow(TypeError)
  })

  it('leaves the hash unchanged after a reader tried every write', async () => {
    const live = await twoBodies()
    const before = live.hash()
    const view = readSim(live)
    for (const entity of view.query(Body)) {
      try {
        ;(entity.get(Body) as { x: number }).x = 50
      } catch {}
    }
    try {
      ;(view.resource(Score) as { points: number }).points = 7
    } catch {}
    expect(live.hash()).toBe(before)
  })
})
