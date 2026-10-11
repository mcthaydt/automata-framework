import { afterEach, expect, test } from 'vitest'
import { z } from 'zod'
import { defineCommand, definePlugin, defineSystem } from '../define/definitions'
import { hex64, xxhash64 } from '../hash/xxhash64'
import { Body, fixturePlugin } from '../testing/fixture-world'
import { createSim, type Sim } from '../world/sim'
import { decodeReplay, encodeReplay } from './codec'
import { ReplayRecordError } from './errors'
import { createRecorder } from './recorder'

const sims: Sim[] = []
async function make(plugins = [fixturePlugin]) {
  const sim = await createSim({ seed: 5, plugins })
  sims.push(sim)
  sim.spawn([[Body, { x: 1, vx: 1 }]])
  return sim
}
afterEach(() => {
  for (const s of sims.splice(0)) s.dispose()
})

const push = (tick: number, source: number, seq: number, sid = 1) => ({
  tick,
  source,
  seq,
  type: 'push',
  payload: { sid, dx: 0.5 },
})

test('start is the snapshot when recording began; the header copies the sim and the snapshot', async () => {
  const sim = await make()
  sim.step([])
  const expected = sim.snapshot()
  const rec = createRecorder(sim, { meta: { game: 'test' } })
  const replay = rec.finish()
  expect(replay.start).toEqual(expected)
  const view = sim.describeSnapshot(expected)
  expect(replay.header).toEqual({
    tickHz: 60,
    seed: 5,
    schemaHash: view.header.schemaHash,
    contentHash: view.header.contentHash,
    startTick: 1,
    checkEvery: 60,
    framework: '0.0.0',
    meta: { game: 'test' },
  })
  expect(replay.finalTick).toBe(1)
  expect(replay.finalHash).toBe(sim.hash())
})

test('only accepted commands are recorded, in (source, seq) order, at the tick before their step', async () => {
  const sim = await make()
  const rec = createRecorder(sim)
  rec.step([])
  const result = rec.step([push(1, 2, 1), push(1, 0, 7), push(5, 0, 8), push(1, 0, 3)])
  expect(result.rejected.map((r) => r.reason)).toEqual(['wrong-tick'])
  rec.step([push(2, 0, 9, 99)]) // accepted (the system ignores a missing entity), so recorded
  const replay = rec.finish()
  expect(replay.ticks).toEqual([
    {
      tick: 1,
      commands: [
        { source: 0, seq: 3, type: 'push', payload: { sid: 1, dx: 0.5 } },
        { source: 0, seq: 7, type: 'push', payload: { sid: 1, dx: 0.5 } },
        { source: 2, seq: 1, type: 'push', payload: { sid: 1, dx: 0.5 } },
      ],
    },
    { tick: 2, commands: [{ source: 0, seq: 9, type: 'push', payload: { sid: 99, dx: 0.5 } }] },
  ])
})

test('an explicit undefined optional field records without the key', async () => {
  const Opt = defineCommand('opt', z.object({ a: z.number(), b: z.number().optional() }))
  const plugin = definePlugin({
    name: 'opt',
    commands: [Opt],
    systems: [defineSystem({ name: 'opt.read', phase: 'input', run: (ctx) => void ctx.commands.of(Opt) })],
  })
  const sim = await make([fixturePlugin, plugin])
  const rec = createRecorder(sim)
  rec.step([{ tick: 0, source: 0, seq: 1, type: 'opt', payload: { a: 1, b: undefined } }])
  const replay = decodeReplay(encodeReplay(rec.finish()))
  expect(replay.ticks[0]?.commands[0]?.payload).toEqual({ a: 1 })
  expect(Object.keys(replay.ticks[0]?.commands[0]?.payload as object)).toEqual(['a'])
})

test('checks every 60 ticks from the start and the final hash', async () => {
  const sim = await make()
  for (let t = 0; t < 5; t++) sim.step([])
  const rec = createRecorder(sim)
  const hashes: string[] = []
  for (let t = 0; t < 130; t++) {
    rec.step([])
    hashes.push(sim.hash())
  }
  const replay = rec.finish()
  expect(replay.checks).toEqual([
    { tick: 65, hash: hashes[59] },
    { tick: 125, hash: hashes[119] },
  ])
  expect(replay.finalTick).toBe(135)
  expect(replay.finalHash).toBe(hashes[129])
  expect(replay.reference).toBeUndefined()
})

test('reference data: a hash after every step and a snapshot every snapshotEvery ticks', async () => {
  const sim = await make()
  const rec = createRecorder(sim, { checkEvery: 4, reference: { snapshotEvery: 3 } })
  const hashes: string[] = []
  const snaps: Uint8Array[] = []
  for (let t = 0; t < 7; t++) {
    rec.step([])
    hashes.push(sim.hash())
    snaps.push(sim.snapshot())
  }
  const replay = rec.finish()
  expect(replay.checks.map((c) => c.tick)).toEqual([4])
  expect(replay.reference?.hashes).toEqual(hashes)
  expect(replay.reference?.snapshots).toEqual([
    { tick: 3, bytes: snaps[2] },
    { tick: 6, bytes: snaps[5] },
  ])
  expect(hex64(xxhash64(snaps[5] as Uint8Array))).toBe(hashes[5])
})

test('stepping the sim outside the recorder is a ReplayRecordError', async () => {
  const sim = await make()
  const rec = createRecorder(sim)
  rec.step([])
  sim.step([])
  expect(() => rec.step([])).toThrow(ReplayRecordError)
  expect(() => rec.finish()).toThrow(/outside the recorder/)
})

test('an accepted payload that is not canonical JSON (NaN) is a ReplayRecordError', async () => {
  const Any = defineCommand('any', z.unknown())
  const plugin = definePlugin({
    name: 'any',
    commands: [Any],
    systems: [defineSystem({ name: 'any.read', phase: 'input', run: (ctx) => void ctx.commands.of(Any) })],
  })
  const sim = await make([fixturePlugin, plugin])
  const rec = createRecorder(sim)
  expect(() => rec.step([{ tick: 0, source: 0, seq: 1, type: 'any', payload: { n: Number.NaN } }])).toThrow(
    ReplayRecordError,
  )
  // The recording can no longer be exact, so the recorder refuses everything after.
  expect(() => rec.step([])).toThrow(ReplayRecordError)
})

test('finish twice and options below 1 are ReplayRecordErrors', async () => {
  const sim = await make()
  const rec = createRecorder(sim)
  rec.finish()
  expect(() => rec.finish()).toThrow(/finished/)
  expect(() => rec.step([])).toThrow(/finished/)
  expect(() => createRecorder(sim, { checkEvery: 0 })).toThrow(ReplayRecordError)
  expect(() => createRecorder(sim, { checkEvery: 1.5 })).toThrow(ReplayRecordError)
  expect(() => createRecorder(sim, { reference: { snapshotEvery: 0 } })).toThrow(ReplayRecordError)
})
