import { afterEach, expect, test } from 'vitest'
import { z } from 'zod'
import { defineCommand, defineComponent, definePlugin, defineSystem } from '../define/definitions'
import { createRng } from '../rng/rng'
import { Body, fixturePlugin, Tag } from '../testing/fixture-world'
import { type Command, createSim, type Sim } from '../world/sim'
import { SnapshotMismatchError } from '../world/snapshot'
import { decodeReplay, encodeReplay } from './codec'
import { ReplayFormatError } from './errors'
import { createRecorder } from './recorder'
import type { Replay } from './replay'
import { createReplayStepper, type ReplayStepper } from './stepper'

const open: Array<Sim | ReplayStepper> = []
afterEach(() => {
  for (const s of open.splice(0)) s.dispose()
})
async function make(plugins = [fixturePlugin], content: unknown = { level: 1 }) {
  const sim = await createSim({ seed: 11, plugins, content })
  open.push(sim)
  for (let i = 0; i < 4; i++)
    sim.spawn([
      [Body, { x: i, vx: 1 }],
      [Tag, { name: `t${i}` }],
    ])
  return sim
}
async function stepper(replay: Replay, plugins = [fixturePlugin], content: unknown = { level: 1 }) {
  const s = await createReplayStepper(replay, { plugins, content })
  open.push(s)
  return s
}

/** Random pushes from a seeded script, some on wrong ticks so they are rejected and not recorded. */
function script(seed: number) {
  const rng = createRng(seed)
  let seq = 0
  return (tick: number): Command[] =>
    rng.next() < 0.3
      ? [
          {
            tick: rng.next() < 0.1 ? tick + 1 : tick,
            source: rng.int(3),
            seq: ++seq,
            type: 'push',
            payload: { sid: 1 + rng.int(6), dx: rng.int(5) - 2 },
          },
        ]
      : []
}

async function record(sim: Sim, ticks: number) {
  const rec = createRecorder(sim)
  const next = script(3)
  for (let t = 0; t < ticks; t++) rec.step(next(sim.tick))
  return decodeReplay(encodeReplay(rec.finish()))
}

test('a recorded 300-tick run plays back to the same final hash, passing every check', async () => {
  const sim = await make()
  const replay = await record(sim, 300)
  expect(replay.ticks.length).toBeGreaterThan(20)
  const s = await stepper(replay)
  expect(s.tick).toBe(0)
  const outcome = s.run()
  expect(outcome).toEqual({ ok: true, checks: 5 })
  expect(s.done).toBe(true)
  expect(s.sim.hash()).toBe(replay.finalHash)
  expect(s.sim.hash()).toBe(sim.hash())
})

test('step() reports each step and its check', async () => {
  const sim = await make()
  const replay = await record(sim, 61)
  const s = await stepper(replay)
  const first = s.step()
  expect(first.tick).toBe(1)
  expect(first.check).toBeUndefined()
  for (let t = 1; t < 59; t++) s.step()
  const sixtieth = s.step()
  expect(sixtieth.check).toEqual({ expected: replay.checks[0]?.hash, actual: replay.checks[0]?.hash })
  expect(s.step().check).toEqual({ expected: replay.finalHash, actual: replay.finalHash })
  expect(s.done).toBe(true)
  expect(() => s.step()).toThrow(/finished/)
})

test('a run recorded from a mid-run checkpoint plays back from it', async () => {
  const sim = await make()
  const before = script(9)
  for (let t = 0; t < 50; t++) sim.step(before(sim.tick))
  const replay = await record(sim, 100)
  expect(replay.header.startTick).toBe(50)
  const s = await stepper(replay)
  expect(s.tick).toBe(50)
  expect(s.run()).toEqual({ ok: true, checks: 2 })
  expect(s.sim.hash()).toBe(sim.hash())
})

test('a schema change and a content change refuse at creation', async () => {
  const replay = await record(await make(), 10)
  const extra = definePlugin({ name: 'extra', components: [defineComponent('extra.thing', { n: 'u32' })] })
  const schema = await createReplayStepper(replay, {
    plugins: [fixturePlugin, extra],
    content: { level: 1 },
  }).catch((err: unknown) => err)
  expect(schema).toBeInstanceOf(SnapshotMismatchError)
  expect((schema as SnapshotMismatchError).field).toBe('schemaHash')
  const content = await createReplayStepper(replay, {
    plugins: [fixturePlugin],
    content: { level: 2 },
  }).catch((err: unknown) => err)
  expect(content).toBeInstanceOf(SnapshotMismatchError)
  expect((content as SnapshotMismatchError).field).toBe('contentHash')
})

test('a header that disagrees with its start snapshot refuses at creation', async () => {
  const replay = await record(await make(), 10)
  // A forged start tick: the snapshot is at tick 0, so a check-free run could otherwise pass.
  const ticked = await createReplayStepper(
    { ...replay, header: { ...replay.header, startTick: 50 }, ticks: [], checks: [], finalTick: 50 },
    { plugins: [fixturePlugin], content: { level: 1 } },
  ).catch((err: unknown) => err)
  expect(ticked).toBeInstanceOf(ReplayFormatError)
  expect((ticked as Error).message).toMatch(/start snapshot is at tick 0, the header says startTick 50/)
  for (const field of ['schemaHash', 'contentHash'] as const) {
    const forged = await createReplayStepper(
      { ...replay, header: { ...replay.header, [field]: 'ffffffffffffffff' } },
      { plugins: [fixturePlugin], content: { level: 1 } },
    ).catch((err: unknown) => err)
    expect(forged).toBeInstanceOf(ReplayFormatError)
    expect((forged as Error).message).toMatch(new RegExp(`header ${field} ffffffffffffffff`))
  }
})

function kickPlugin(refined: boolean) {
  const payload = z.object({ ball: z.number().int() })
  const Kick = defineCommand('kick', refined ? payload.refine((p) => p.ball !== 3) : payload)
  return definePlugin({
    name: 'kick',
    commands: [Kick],
    systems: [defineSystem({ name: 'kick.read', phase: 'input', run: (ctx) => void ctx.commands.of(Kick) })],
  })
}

test('a recorded command the current code rejects fails its tick’s check (a .refine() keeps the schema hash)', async () => {
  const loose = await createSim({ seed: 1, plugins: [kickPlugin(false)] })
  const strict = await createSim({ seed: 1, plugins: [kickPlugin(true)] })
  open.push(loose, strict)
  expect(strict.describeSnapshot().header.schemaHash).toBe(loose.describeSnapshot().header.schemaHash)

  const rec = createRecorder(loose)
  rec.step([])
  rec.step([{ tick: 1, source: 0, seq: 1, type: 'kick', payload: { ball: 3 } }])
  rec.step([])
  const replay = rec.finish()
  const s = await stepper(replay, [kickPlugin(true)], {})
  expect(s.step().check).toBeUndefined()
  expect(s.step().check).toEqual({ expected: 'accepted', actual: 'invalid-payload' })
  const again = await stepper(replay, [kickPlugin(true)], {})
  expect(again.run()).toEqual({
    ok: false,
    checks: 0,
    failed: { tick: 2, expected: 'accepted', actual: 'invalid-payload' },
  })
})

test('dispose twice is safe and frees the sim', async () => {
  const replay = await record(await make(), 5)
  const s = await createReplayStepper(replay, { plugins: [fixturePlugin], content: { level: 1 } })
  s.dispose()
  s.dispose()
  expect(() => s.sim.hash()).toThrow(/disposed/)
})
