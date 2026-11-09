import { fakeClock } from '@automata/framework/testing'
import { describe, expect, it } from 'vitest'
import { CONTEXT_RESTORE_MS, watchContextLoss } from '#src/features/renderer/context-loss.ts'

/** The watcher with a canvas, a bus and the "gone" callback recorded, run on a fake clock. */
const setup = (device?: { lost: Promise<unknown> }) => {
  const canvas = new EventTarget()
  const facts: string[] = []
  const clock = fakeClock()
  let gone = 0
  const watch = watchContextLoss({
    canvas,
    device,
    bus: { publish: (name) => void facts.push(name), subscribe: () => () => {} },
    clock,
    onGone: () => {
      gone += 1
    },
  })
  return { canvas, clock, facts, gone: () => gone, watch }
}

describe('watchContextLoss (M3 spec §5, review of #241)', () => {
  it('gives the context back to the renderer when the browser restores it in time', () => {
    const { canvas, clock, facts, gone, watch } = setup()
    canvas.dispatchEvent(new Event('webglcontextlost'))
    expect(watch.lost()).toBe(true)
    clock.advance(CONTEXT_RESTORE_MS - 1)
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    clock.advance(CONTEXT_RESTORE_MS)
    expect(watch.lost()).toBe(false)
    expect(gone()).toBe(0)
    expect(facts).toEqual(['render.context.lost', 'render.context.restored'])
    watch.stop()
  })

  it('reports the context gone when the browser has not restored it after the wait', () => {
    const { canvas, clock, gone, watch } = setup()
    canvas.dispatchEvent(new Event('webglcontextlost'))
    clock.advance(CONTEXT_RESTORE_MS)
    expect(gone()).toBe(1)
    expect(watch.lost()).toBe(true)
    watch.stop()
  })

  it('reports a lost WebGPU device at once: a lost device never comes back', async () => {
    let lose: (info: unknown) => void = () => {}
    const lost = new Promise<unknown>((resolve) => {
      lose = resolve
    })
    const { facts, gone, watch } = setup({ lost })
    lose({ reason: 'unknown' })
    await lost
    await Promise.resolve()
    expect(facts).toEqual(['render.context.lost'])
    expect(gone()).toBe(1)
    expect(watch.lost()).toBe(true)
    watch.stop()
  })

  it('does nothing after it stops', () => {
    const { canvas, clock, facts, gone, watch } = setup()
    watch.stop()
    canvas.dispatchEvent(new Event('webglcontextlost'))
    clock.advance(CONTEXT_RESTORE_MS)
    expect(facts).toEqual([])
    expect(gone()).toBe(0)
  })

  it('leaves no timeout waiting once it stops', () => {
    const { canvas, clock, watch } = setup()
    canvas.dispatchEvent(new Event('webglcontextlost'))
    expect(clock.pending()).toBe(1)
    watch.stop()
    expect(clock.pending()).toBe(0)
  })
})
