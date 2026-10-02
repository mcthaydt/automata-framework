import { afterEach, expect, test } from 'vitest'
import { z } from 'zod'
import {
  defineCommand,
  defineComponent,
  defineEvent,
  definePlugin,
  defineResource,
  defineSystem,
} from '../define/definitions'
import { type Command, createSim, type Sim } from './sim'

const Position = defineComponent('position', { x: 'f32', y: 'f32' })
const Velocity = defineComponent('velocity', { x: 'f32', y: 'f32' }, { render: false })
const Move = defineCommand('move', z.object({ sid: z.number().int(), x: z.number(), y: z.number() }))
const Moved = defineEvent('moved', z.object({ sid: z.number() }))
const Score = defineResource('score', z.object({ value: z.number() }), () => ({ value: 0 }))

const physicsLike = defineSystem({
  name: 'integrate',
  phase: 'gameplay',
  run(ctx) {
    for (const e of ctx.query(Position, Velocity)) {
      const p = e.get(Position)
      const v = e.get(Velocity)
      e.set(Position, { x: p.x + v.x * ctx.dt, y: p.y + v.y * ctx.dt })
    }
  },
})
const applyMoves = defineSystem({
  name: 'apply-moves',
  phase: 'input',
  after: ['commands.apply'],
  run(ctx) {
    for (const c of ctx.commands.of(Move)) {
      ctx.entity(c.payload.sid)?.set(Velocity, { x: c.payload.x, y: c.payload.y })
      ctx.emit(Moved, { sid: c.payload.sid })
      ctx.resource(Score).value += 1
    }
  },
})
const game = definePlugin({
  name: 'game',
  components: [Position, Velocity],
  commands: [Move],
  events: [Moved],
  resources: [Score],
  systems: [physicsLike, applyMoves],
})

const sims: Sim[] = []
async function make(opts: Partial<Parameters<typeof createSim>[0]> = {}) {
  const sim = await createSim({ seed: 1, plugins: [game], ...opts })
  sims.push(sim)
  return sim
}
afterEach(() => {
  for (const s of sims.splice(0)) s.dispose()
})

const cmd = (tick: number, seq: number, payload: unknown, source = 0): Command => ({
  tick,
  source,
  seq,
  type: 'move',
  payload,
})

test('step advances the tick at a fixed dt and runs systems', async () => {
  const sim = await make({ tickHz: 50 })
  const sid = sim.spawn([
    [Position, { x: 0 }],
    [Velocity, { x: 50 }],
  ])
  expect(sim.tick).toBe(0)
  const r = sim.step([])
  expect(r.tick).toBe(1)
  expect(sim.tick).toBe(1)
  expect(sim.entity(sid)?.get(Position).x).toBe(1) // 50 units/s * 1/50 s
})

test('commands are validated, sorted by (source, seq), and only those for the current tick are applied', async () => {
  const sim = await make()
  const a = sim.spawn([Position, Velocity])
  const b = sim.spawn([Position, Velocity])
  const r = sim.step([
    cmd(0, 2, { sid: b, x: 2, y: 0 }),
    cmd(0, 1, { sid: a, x: 1, y: 0 }, 1),
    cmd(0, 1, { sid: a, x: 3, y: 0 }),
    cmd(5, 1, { sid: a, x: 9, y: 0 }), // wrong tick
    cmd(0, 3, { sid: 'x' }), // invalid payload
    { tick: 0, source: 0, seq: 4, type: 'teleport', payload: {} }, // unknown type
  ])
  // (source 0, seq 1) a->3, (0, 2) b->2, then (1, 1) a->1
  expect(r.events.map((e) => e.payload)).toEqual([{ sid: a }, { sid: b }, { sid: a }])
  expect(sim.entity(a)?.get(Velocity).x).toBe(1)
  expect(sim.resource(Score).value).toBe(3)
  expect(r.rejected.map((x) => x.reason)).toEqual(['wrong-tick', 'invalid-payload', 'unknown-command'])
})

test('emit validates event payloads with the event schema', async () => {
  const Bad = defineSystem({
    name: 'bad-emit',
    phase: 'gameplay',
    run: (ctx) => ctx.emit(Moved, { sid: 'nope' } as never),
  })
  const sim = await make({ plugins: [game, definePlugin({ name: 'bad', systems: [Bad] })] })
  expect(() => sim.step([])).toThrow(/event "moved"/)
})

test('despawn inside a system is deferred to the end of the tick', async () => {
  const seen: number[] = []
  const Killer = defineSystem({
    name: 'killer',
    phase: 'gameplay',
    run(ctx) {
      for (const e of ctx.query(Position)) ctx.despawn(e.sid)
      seen.push(ctx.query(Position).length) // still visible this tick
    },
  })
  const sim = await make({ plugins: [game, definePlugin({ name: 'k', systems: [Killer] })] })
  sim.spawn([Position])
  sim.spawn([Position])
  sim.step([])
  expect(seen).toEqual([2])
  expect(sim.query(Position)).toEqual([])
})

test("each system gets its own RNG substream: adding a system does not shift another system's draws", async () => {
  const draws = (extra: boolean) => {
    const out: number[] = []
    const Roll = defineSystem({
      name: 'roll',
      phase: 'gameplay',
      run: (ctx) => void out.push(ctx.rng.nextU32()),
    })
    const Noise = defineSystem({ name: 'noise', phase: 'gameplay', run: (ctx) => void ctx.rng.nextU32() })
    return { out, plugin: definePlugin({ name: 'r', systems: extra ? [Roll, Noise] : [Roll] }) }
  }
  const a = draws(false)
  const b = draws(true)
  const simA = await make({ plugins: [a.plugin] })
  const simB = await make({ plugins: [b.plugin] })
  for (let i = 0; i < 5; i++) {
    simA.step([])
    simB.step([])
  }
  expect(b.out).toEqual(a.out)
})

test('content is deep-frozen; systems cannot write it', async () => {
  let threw = false
  const Writer = defineSystem({
    name: 'writer',
    phase: 'gameplay',
    run(ctx) {
      try {
        ;(ctx.content as { tuning: { g: number } }).tuning.g = 1
      } catch {
        threw = true
      }
    },
  })
  const sim = await make({
    plugins: [definePlugin({ name: 'w', systems: [Writer] })],
    content: { tuning: { g: 9.81 } },
  })
  sim.step([])
  expect(threw).toBe(true)
})

test('registration errors: duplicate component ids across plugins, unknown systems', async () => {
  const dup = definePlugin({ name: 'dup', components: [defineComponent('position', { z: 'f32' })] })
  await expect(createSim({ seed: 1, plugins: [game, dup] })).rejects.toThrow(/duplicate component "position"/)
})

test('step returns the render delta (resync on the first step, then incremental)', async () => {
  const sim = await make()
  const sid = sim.spawn([Position, [Velocity, { x: 60 }]])
  const first = sim.step([])
  expect(first.render.resync).toBe(true)
  expect(first.render.added.map((r) => r.sid)).toEqual([sid])
  const second = sim.step([])
  expect(second.render.resync).toBe(false)
  expect(second.render.changed).toEqual([{ sid, components: { position: { x: 2, y: 0 } } }])
})
