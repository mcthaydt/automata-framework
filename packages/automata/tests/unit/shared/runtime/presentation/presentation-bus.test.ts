import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import {
  createPresentationBus,
  type PresentationBus,
  typedBus,
} from '#src/shared/runtime/presentation/presentation-bus.manager.ts'

describe('PresentationBus', () => {
  it('delivers facts published from inside a listener after all listeners of the current fact', () => {
    const bus = createPresentationBus()
    const calls: string[] = []

    bus.subscribe('time.changed', () => {
      calls.push('time1')
      bus.publish('screen.entered', { screen: 'menu', from: undefined })
    })
    bus.subscribe('time.changed', () => {
      calls.push('time2')
    })
    bus.subscribe('screen.entered', () => {
      calls.push('screen1')
    })

    bus.publish('time.changed', { paused: true })

    expect(calls).toEqual(['time1', 'time2', 'screen1'])
  })

  it('unsubscribes idempotently', () => {
    const bus = createPresentationBus()
    let count = 0
    const unsub = bus.subscribe('time.changed', () => {
      count++
    })

    bus.publish('time.changed', { paused: true })
    expect(count).toBe(1)

    unsub()
    unsub() // idempotent
    bus.publish('time.changed', { paused: false })
    expect(count).toBe(1)
  })

  it('handles a listener unsubscribing another listener mid-delivery', () => {
    const bus = createPresentationBus()
    const calls: string[] = []

    let unsub2: () => void = () => {}
    bus.subscribe('time.changed', () => {
      calls.push('l1')
      unsub2()
    })
    unsub2 = bus.subscribe('time.changed', () => {
      calls.push('l2')
    })
    bus.subscribe('time.changed', () => {
      calls.push('l3')
    })

    bus.publish('time.changed', { paused: true })

    expect(calls).toEqual(['l1', 'l3'])
  })

  it('drops queued facts and listeners on dispose, disposing twice is safe, and publish after close is a no-op', () => {
    let screenReceived = 0

    const bus = createPresentationBus()

    bus.subscribe('time.changed', () => {
      bus.publish('screen.entered', { screen: 'game', from: undefined })
      bus.dispose()
    })

    bus.subscribe('screen.entered', () => {
      screenReceived++
    })

    bus.publish('time.changed', { paused: true })
    expect(screenReceived).toBe(0)

    bus.dispose()
    // Safe to dispose again
    bus.dispose()

    // publish after close does nothing
    bus.publish('time.changed', { paused: true })
    expect(screenReceived).toBe(0)
  })

  it('isolates a throwing listener: error goes to injected log, remaining listeners and queued facts still delivered', () => {
    const log = vi.fn()
    const bus = createPresentationBus(log)
    const calls: string[] = []

    const boom = new Error('boom')
    bus.subscribe('time.changed', () => {
      calls.push('l1')
      throw boom
    })
    bus.subscribe('time.changed', () => {
      calls.push('l2')
      bus.publish('screen.entered', { screen: 'game', from: 'menu' })
    })
    bus.subscribe('screen.entered', () => {
      calls.push('screen1')
    })

    bus.publish('time.changed', { paused: true })

    expect(calls).toEqual(['l1', 'l2', 'screen1'])
    expect(log).toHaveBeenCalledWith(boom)
  })

  it('typedBus returns the same object with generic typing', () => {
    const bus = createPresentationBus()
    type CustomFacts = {
      'game.scored': number
    }
    const typed = typedBus<CustomFacts>(bus)
    expect(typed).toBe(bus)
    expectTypeOf(typed).toEqualTypeOf<PresentationBus<CustomFacts>>()
  })
})
