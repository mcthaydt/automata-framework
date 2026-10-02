import { afterEach, expect, test } from 'vitest'
import { definePlugin } from '../define/definitions'
import { Body, fixturePlugin, Stats, Tag } from '../testing/fixture-world'
import { createSim, type Sim } from './sim'
import { SnapshotFormatError, SnapshotMismatchError } from './snapshot'

const sims: Sim[] = []
async function make(opts: Partial<Parameters<typeof createSim>[0]> = {}) {
  const sim = await createSim({ seed: 9, plugins: [fixturePlugin], content: { level: 'a' }, ...opts })
  sims.push(sim)
  return sim
}
afterEach(() => {
  for (const s of sims.splice(0)) s.dispose()
})

const push = (tick: number, sid: number) => [
  { tick, source: 0, seq: 1, type: 'push', payload: { sid, dx: 0.25 } },
]

async function seeded() {
  const sim = await make()
  for (let i = 0; i < 6; i++)
    sim.spawn([
      [Body, { x: i }],
      [Tag, { name: `n${i}`, team: i }],
    ])
  return sim
}

test('snapshot -> restore into a fresh sim -> continue is identical to an uninterrupted run', async () => {
  const straight = await seeded()
  for (let t = 0; t < 120; t++) straight.step(t % 7 === 0 ? push(t, 1 + (t % 5)) : [])

  const first = await seeded()
  for (let t = 0; t < 60; t++) first.step(t % 7 === 0 ? push(t, 1 + (t % 5)) : [])
  const bytes = first.snapshot()
  const resumed = await make()
  resumed.restore(bytes)
  expect(resumed.tick).toBe(60)
  for (let t = 60; t < 120; t++) resumed.step(t % 7 === 0 ? push(t, 1 + (t % 5)) : [])

  expect(resumed.hash()).toBe(straight.hash())
  expect(resumed.resource(Stats)).toEqual(straight.resource(Stats))
  expect(resumed.query(Tag).length).toBeGreaterThan(6)
})

test('snapshot bytes are canonical: restore then snapshot reproduces them exactly', async () => {
  const sim = await seeded()
  for (let t = 0; t < 30; t++) sim.step([])
  const bytes = sim.snapshot()
  const other = await make()
  other.restore(bytes)
  expect(other.snapshot()).toEqual(bytes)
  expect(other.hash()).toBe(sim.hash())
})

test('hash is 16 hex digits and changes when state changes', async () => {
  const sim = await seeded()
  const h0 = sim.hash()
  expect(h0).toMatch(/^[0-9a-f]{16}$/)
  sim.step([])
  expect(sim.hash()).not.toBe(h0)
})

test('the first step after restore is a full render resync', async () => {
  const sim = await seeded()
  sim.step([])
  sim.step([])
  const other = await make()
  other.restore(sim.snapshot())
  const r = other.step([])
  expect(r.render.resync).toBe(true)
  expect(r.render.added.length).toBe(other.query(Body).length)
})

test('restore refuses a different schema, content or tickHz, naming the field', async () => {
  const bytes = (await seeded()).snapshot()
  const otherSchema = await make({ plugins: [fixturePlugin, definePlugin({ name: 'extra' })] })
  expect(() => otherSchema.restore(bytes)).toThrow(SnapshotMismatchError)
  expect(() => otherSchema.restore(bytes)).toThrow(/schemaHash/)
  const otherContent = await make({ content: { level: 'b' } })
  expect(() => otherContent.restore(bytes)).toThrow(/contentHash/)
  const otherHz = await make({ tickHz: 30 })
  expect(() => otherHz.restore(bytes)).toThrow(/tickHz/)
})

test('restore rejects garbage and truncated input with SnapshotFormatError, leaving the sim usable', async () => {
  const sim = await seeded()
  const bytes = sim.snapshot()
  const before = sim.hash()
  expect(() => sim.restore(new Uint8Array([1, 2, 3]))).toThrow(SnapshotFormatError)
  expect(() => sim.restore(bytes.slice(0, bytes.length - 5))).toThrow(SnapshotFormatError)
  const wrongVersion = bytes.slice()
  wrongVersion[4] = 99
  expect(() => sim.restore(wrongVersion)).toThrow(/version/)
  expect(sim.hash()).toBe(before)
  sim.step([])
})

test('snapshot fails loudly, naming the resource, when a system left a resource outside its schema', async () => {
  const sim = await seeded()
  ;(sim.resource(Stats) as { spawned: unknown }).spawned = 'not a number'
  expect(() => sim.snapshot()).toThrow(/resource "stats"/)
})

test('an empty sim (no entities, no resources) round-trips', async () => {
  const empty = await make({ plugins: [definePlugin({ name: 'empty' })] })
  const other = await make({ plugins: [definePlugin({ name: 'empty' })] })
  other.restore(empty.snapshot())
  expect(other.hash()).toBe(empty.hash())
  expect(other.step([]).render).toEqual({ resync: true, added: [], changed: [], removed: [] })
})
