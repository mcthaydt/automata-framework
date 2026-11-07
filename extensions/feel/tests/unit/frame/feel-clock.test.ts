// Feel's frame times come from the `Clock` it is given: a frame is a pure function of the events, the drawn tick, the
// settings and the clock's readings; and feel never changes the sim, so a run with it hashes the same at every tick as a run
// without it.
import { readFileSync } from 'node:fs'
import { fakeClock } from '@automata/framework/testing'
import { createSim, defineEvent, definePlugin, defineResource, defineSystem, type Sim } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { make, slam } from '#src/testing/feel-table.ts'

interface Recording {
  readonly steps: readonly number[]
  readonly frames: readonly { frozen: number[]; squash: [number, [number, number]][] }[]
}
/** Frames recorded before feel left Effect: a slam heard at tick 2, a 16 ms frame time, then one 5 s stall. */
const recorded = JSON.parse(
  readFileSync(new URL('../../fixtures/feel-clock.json', import.meta.url), 'utf8'),
) as Recording

describe('frameNow reads the clock it was given', () => {
  it('reads the frame times from the clock: a 90 ms freeze is over after two 50 ms frames', () => {
    const clock = fakeClock()
    const feel = make({ clock })
    feel.hear(0, [slam(7)])
    const first = feel.frameNow(0, 0)
    clock.advance(50)
    const second = feel.frameNow(1, 0)
    clock.advance(50)
    const third = feel.frameNow(2, 0)
    expect(first.frozen).toEqual([7])
    expect(second.frozen).toEqual([7])
    expect(third.frozen).toEqual([])
  })
  it('gives the same frames on every run', () => {
    const once = () => {
      const clock = fakeClock()
      const feel = make({ clock })
      feel.hear(10, [slam(7)])
      const out = []
      for (let tick = 0; tick < 40; tick += 1) {
        out.push(feel.frameNow(tick, 0))
        clock.advance(16)
      }
      return out
    }
    expect(once()).toEqual(once())
  })
  it('gives the frames the Effect version gave over the same readings, stall included', () => {
    const clock = fakeClock()
    const feel = make({ clock })
    feel.hear(2, [slam(7)])
    recorded.steps.forEach((step, tick) => {
      const frame = feel.frameNow(tick, 0)
      expect({ ...frame, squash: [...frame.squash.entries()] }).toEqual(recorded.frames[tick])
      clock.advance(step)
    })
    const last = feel.frameNow(recorded.steps.length, 0)
    expect({ ...last, squash: [...last.squash.entries()] }).toEqual(recorded.frames[recorded.steps.length])
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
