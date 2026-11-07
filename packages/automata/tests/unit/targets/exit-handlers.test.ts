import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeExitHandlers } from '#src/features/targets/exit-handlers.ts'
import { fakeClock } from '#src/testing/fake-clock.ts'

/** Lets promise callbacks queued so far run. */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('exit handlers', () => {
  afterEach(() => vi.restoreAllMocks())

  it('runs the handlers in registration order, then the last step', async () => {
    const order: string[] = []
    const exits = makeExitHandlers(1000, fakeClock())
    exits.register(() => void order.push('first'))
    exits.register(async () => void order.push('second'))
    await exits.run(() => void order.push('flush'))
    expect(order).toEqual(['first', 'second', 'flush'])
  })

  it('skips a handler that was taken back', async () => {
    const order: string[] = []
    const exits = makeExitHandlers(1000, fakeClock())
    const takeBack = exits.register(() => void order.push('gone'))
    exits.register(() => void order.push('kept'))
    takeBack()
    await exits.run(() => undefined)
    expect(order).toEqual(['kept'])
  })

  it('logs a handler that fails and still runs the next one and the last step', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const order: string[] = []
    const exits = makeExitHandlers(1000, fakeClock())
    exits.register(() => {
      throw new Error('boom')
    })
    exits.register(() => void order.push('next'))
    await exits.run(() => void order.push('flush'))
    expect(order).toEqual(['next', 'flush'])
    expect(warn).toHaveBeenCalledOnce()
  })

  it('answers at the cap when a handler never returns, and skips what comes after it', async () => {
    const clock = fakeClock()
    const order: string[] = []
    const exits = makeExitHandlers(1000, clock)
    exits.register(() => new Promise<void>(() => undefined))
    let answered = false
    const running = exits
      .run(() => void order.push('flush'))
      .then(() => {
        answered = true
      })
    await flush()
    clock.advance(999)
    await flush()
    expect(answered).toBe(false)
    clock.advance(1)
    await running
    expect(answered).toBe(true)
    expect(order).toEqual([])
  })

  it('clears its timer when everything finishes in time', async () => {
    const clock = fakeClock()
    const exits = makeExitHandlers(1000, clock)
    await exits.run(() => undefined)
    expect(clock.pending()).toBe(0)
  })
})
