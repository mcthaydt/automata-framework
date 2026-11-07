// Feel under Effect's `Clock` (M6.1a step 5, F-a, F-b): the frame times come from the presentation clock, `TestClock` in tests;
// and feel never changes the sim, so a run with it hashes the same at every tick as a run without it.
import {
  createSim,
  defineEvent,
  definePlugin,
  defineResource,
  defineSystem,
  type Sim,
} from '@mcthaydt/automata-sim'
import { Effect, TestClock, TestContext } from 'effect'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { make, slam } from './testing/feel-table'

const run = <A>(program: Effect.Effect<A, never, never>) =>
  Effect.runPromise(Effect.provide(program, TestContext.TestContext))

describe('frameNow under TestClock', () => {
  it('reads the frame times from the clock: a 90 ms freeze is over after two 50 ms frames', async () => {
    const [a, b, c] = await run(
      Effect.gen(function* () {
        const feel = make()
        feel.hear(0, [slam(7)])
        const first = yield* feel.frameNow(0, 0)
        yield* TestClock.adjust('50 millis')
        const second = yield* feel.frameNow(1, 0)
        yield* TestClock.adjust('50 millis')
        const third = yield* feel.frameNow(2, 0)
        return [first, second, third] as const
      }),
    )
    expect(a.frozen).toEqual([7])
    expect(b.frozen).toEqual([7])
    expect(c.frozen).toEqual([])
  })
  it('gives the same frames on every run', async () => {
    const once = () =>
      run(
        Effect.gen(function* () {
          const feel = make()
          feel.hear(10, [slam(7)])
          const out = []
          for (let tick = 0; tick < 40; tick += 1) {
            out.push(yield* feel.frameNow(tick, 0))
            yield* TestClock.adjust('16 millis')
          }
          return out
        }),
      )
    expect(await once()).toEqual(await once())
  })
})

// A one-view sim: a position that moves every tick, and a `slam` event at tick 10.
const Slam = defineEvent('toy.slam', z.strictObject({ entity: z.number().int() }))
const Pos = defineResource('toy.pos', z.strictObject({ x: z.number().int() }), () => ({ x: 0 }))
const toy = definePlugin({
  name: 'toy',
  resources: [Pos],
  events: [Slam],
  systems: [
    defineSystem('toy.move', 'gameplay', (ctx) => {
      ctx.resource(Pos).x += 1
      if (ctx.tick === 10) ctx.emit(Slam, { entity: 1 })
    }),
  ],
})

describe('F-b: hit-stop freezes the view, never the sim', () => {
  const trace = async (withFeel: boolean) => {
    const sim: Sim = await createSim({ seed: 5, plugins: [toy] })
    const feel = make({
      content: () => ({ entry: [{ on: 'toy.slam', pose: [{ hit_stop_ms: 90, target: 'subject' }] }] }),
    })
    const hashes: string[] = []
    const frozenAt: { frozen: boolean; x: number }[] = []
    for (let i = 0; i < 40; i += 1) {
      const { tick, events } = sim.step([])
      if (withFeel) {
        feel.hear(tick - 1, events)
        const frame = feel.frame(tick - 1, 0, 1 / 60)
        frozenAt.push({ frozen: frame.frozen.includes(1), x: sim.resource(Pos).x })
      }
      hashes.push(sim.hash())
    }
    sim.dispose()
    return { hashes, frozenAt }
  }
  it('the sim hash at every tick equals a run without feel', async () => {
    expect((await trace(true)).hashes).toEqual((await trace(false)).hashes)
  })
  it('the frozen view’s position keeps moving in the sim while its pose is held', async () => {
    const { frozenAt } = await trace(true)
    const held = frozenAt.filter((f) => f.frozen)
    expect(held.length).toBeGreaterThanOrEqual(5)
    expect(held.every((f, i) => i === 0 || f.x > (held[i - 1] as { x: number }).x)).toBe(true)
    expect(frozenAt.filter((f) => !f.frozen).length).toBeGreaterThan(0)
  })
})
