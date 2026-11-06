import { Effect, Exit, Scope } from 'effect'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import {
  makePresentationBus,
  type PresentationBus,
  typedBus,
} from '#src/presentation/presentation-bus.manager.ts'

describe('PresentationBus', () => {
  it('delivers facts published from inside a listener after all listeners of the current fact', async () => {
    await Effect.gen(function* () {
      const bus = yield* makePresentationBus()
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
    }).pipe(Effect.scoped, Effect.runPromise)
  })

  it('unsubscribes idempotently', async () => {
    await Effect.gen(function* () {
      const bus = yield* makePresentationBus()
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
    }).pipe(Effect.scoped, Effect.runPromise)
  })

  it('handles a listener unsubscribing another listener mid-delivery', async () => {
    await Effect.gen(function* () {
      const bus = yield* makePresentationBus()
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
    }).pipe(Effect.scoped, Effect.runPromise)
  })

  it('drops queued facts and listeners on scope close, closing twice is safe, and publish after close is a no-op', async () => {
    await Effect.gen(function* () {
      const scope = yield* Scope.make()
      let screenReceived = 0

      const bus = yield* Effect.provideService(makePresentationBus(), Scope.Scope, scope)

      bus.subscribe('time.changed', () => {
        bus.publish('screen.entered', { screen: 'game', from: undefined })
        Effect.runSync(Scope.close(scope, Exit.void))
      })

      bus.subscribe('screen.entered', () => {
        screenReceived++
      })

      bus.publish('time.changed', { paused: true })
      expect(screenReceived).toBe(0)

      yield* Scope.close(scope, Exit.void)
      // Safe to close again
      yield* Scope.close(scope, Exit.void)

      // publish after close does nothing
      bus.publish('time.changed', { paused: true })
      expect(screenReceived).toBe(0)
    }).pipe(Effect.runPromise)
  })

  it('isolates a throwing listener: error goes to injected log, remaining listeners and queued facts still delivered', async () => {
    await Effect.gen(function* () {
      const log = vi.fn()
      const bus = yield* makePresentationBus(log)
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
    }).pipe(Effect.scoped, Effect.runPromise)
  })

  it('typedBus returns the same object with generic typing', async () => {
    await Effect.gen(function* () {
      const bus = yield* makePresentationBus()
      type CustomFacts = {
        'game.scored': number
      }
      const typed = typedBus<CustomFacts>(bus)
      expect(typed).toBe(bus)
      expectTypeOf(typed).toEqualTypeOf<PresentationBus<CustomFacts>>()
    }).pipe(Effect.scoped, Effect.runPromise)
  })
})
