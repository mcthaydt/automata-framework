import { Effect, TestClock, TestContext } from 'effect'
import { describe, expect, it } from 'vitest'
import { CONTEXT_RESTORE_MS, watchContextLoss } from '#src/features/renderer/context-loss.ts'

/** The watcher with a canvas, a bus and the "gone" callback recorded, run on a test clock. */
const setup = (device?: { lost: Promise<unknown> }) =>
  Effect.gen(function* () {
    const canvas = new EventTarget()
    const facts: string[] = []
    let gone = 0
    const runtime = yield* Effect.runtime<never>()
    const watch = watchContextLoss({
      canvas,
      device,
      bus: { publish: (name) => void facts.push(name), subscribe: () => () => {} },
      runtime,
      onGone: () => {
        gone += 1
      },
    })
    return { canvas, facts, gone: () => gone, watch }
  })

const run = <A>(effect: Effect.Effect<A>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestContext.TestContext)))

describe('watchContextLoss (M3 spec §5, review of #241)', () => {
  it('gives the context back to the renderer when the browser restores it in time', () =>
    run(
      Effect.gen(function* () {
        const { canvas, facts, gone, watch } = yield* setup()
        canvas.dispatchEvent(new Event('webglcontextlost'))
        expect(watch.lost()).toBe(true)
        yield* TestClock.adjust(CONTEXT_RESTORE_MS - 1)
        canvas.dispatchEvent(new Event('webglcontextrestored'))
        yield* TestClock.adjust(CONTEXT_RESTORE_MS)
        expect(watch.lost()).toBe(false)
        expect(gone()).toBe(0)
        expect(facts).toEqual(['render.context.lost', 'render.context.restored'])
        watch.stop()
      }),
    ))

  it('reports the context gone when the browser has not restored it after the wait', () =>
    run(
      Effect.gen(function* () {
        const { canvas, gone, watch } = yield* setup()
        canvas.dispatchEvent(new Event('webglcontextlost'))
        yield* TestClock.adjust(CONTEXT_RESTORE_MS)
        yield* Effect.yieldNow()
        expect(gone()).toBe(1)
        expect(watch.lost()).toBe(true)
        watch.stop()
      }),
    ))

  it('reports a lost WebGPU device at once: a lost device never comes back', () =>
    run(
      Effect.gen(function* () {
        let lose: (info: unknown) => void = () => {}
        const lost = new Promise<unknown>((resolve) => {
          lose = resolve
        })
        const { facts, gone, watch } = yield* setup({ lost })
        lose({ reason: 'unknown' })
        yield* Effect.promise(() => lost)
        yield* Effect.yieldNow()
        expect(facts).toEqual(['render.context.lost'])
        expect(gone()).toBe(1)
        expect(watch.lost()).toBe(true)
        watch.stop()
      }),
    ))

  it('does nothing after it stops', () =>
    run(
      Effect.gen(function* () {
        const { canvas, facts, gone, watch } = yield* setup()
        watch.stop()
        canvas.dispatchEvent(new Event('webglcontextlost'))
        yield* TestClock.adjust(CONTEXT_RESTORE_MS)
        expect(facts).toEqual([])
        expect(gone()).toBe(0)
      }),
    ))
})
