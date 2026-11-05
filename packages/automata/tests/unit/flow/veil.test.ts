import { Duration, Effect, Exit, Fiber, Scope, TestClock, TestContext, type TestServices } from 'effect'
import { describe, expect, it } from 'vitest'
import { FADE_MS, makeVeil, REDUCED_FADE_MS } from '#src/features/flow/veil.ts'

const runTest = <A, E>(effect: Effect.Effect<A, E, TestServices.TestServices>): Promise<A> =>
  Effect.runPromise(Effect.provide(effect, TestContext.TestContext) as Effect.Effect<A, E, never>)

describe('fade veil', () => {
  it('cover() takes 350 ms (not done at 349) and its element takes the pointer while covering', async () => {
    const overlay = document.createElement('div')
    document.body.appendChild(overlay)

    await Effect.gen(function* () {
      const scope = yield* Scope.make()
      const veil = yield* makeVeil({
        overlay,
        reducedMotion: () => false,
      }).pipe(Scope.extend(scope))

      expect(overlay.contains(veil.element)).toBe(true)
      expect(veil.element.style.pointerEvents).toBe('none')

      const coverFiber = yield* Effect.fork(veil.cover())
      yield* Effect.yieldNow()

      // Takes pointer while covering
      expect(veil.element.style.pointerEvents).toBe('auto')

      // Advance by 349 ms -> not done yet
      yield* TestClock.adjust(Duration.millis(349))
      const statusAt349 = yield* Fiber.status(coverFiber)
      expect(statusAt349._tag).toBe('Suspended')

      // Advance remaining 1 ms -> finishes
      yield* TestClock.adjust(Duration.millis(1))
      const result = yield* Fiber.join(coverFiber)
      expect(result).toBe(true)
      expect(veil.element.style.pointerEvents).toBe('auto')

      yield* Scope.close(scope, Exit.void)
      expect(overlay.contains(veil.element)).toBe(false)
    }).pipe(runTest)

    overlay.remove()
  })

  it('reveal() takes 350 ms and releases the pointer', async () => {
    const overlay = document.createElement('div')
    document.body.appendChild(overlay)

    await Effect.gen(function* () {
      const scope = yield* Scope.make()
      const veil = yield* makeVeil({
        overlay,
        reducedMotion: () => false,
      }).pipe(Scope.extend(scope))

      // First cover
      const coverFiber = yield* Effect.fork(veil.cover())
      yield* TestClock.adjust(Duration.millis(FADE_MS))
      yield* Fiber.join(coverFiber)
      expect(veil.element.style.pointerEvents).toBe('auto')

      // Now reveal
      const revealFiber = yield* Effect.fork(veil.reveal())

      // Advance 349 ms -> not done yet
      yield* TestClock.adjust(Duration.millis(349))
      const statusAt349 = yield* Fiber.status(revealFiber)
      expect(statusAt349._tag).toBe('Suspended')

      // Advance remaining 1 ms -> completes and releases pointer
      yield* TestClock.adjust(Duration.millis(1))
      yield* Fiber.join(revealFiber)
      expect(veil.element.style.pointerEvents).toBe('none')

      yield* Scope.close(scope, Exit.void)
    }).pipe(runTest)

    overlay.remove()
  })

  it('under reduced motion each half takes 100 ms', async () => {
    const overlay = document.createElement('div')
    document.body.appendChild(overlay)

    await Effect.gen(function* () {
      const scope = yield* Scope.make()
      const veil = yield* makeVeil({
        overlay,
        reducedMotion: () => true,
      }).pipe(Scope.extend(scope))

      // Cover under reduced motion
      const coverFiber = yield* Effect.fork(veil.cover())
      yield* TestClock.adjust(Duration.millis(REDUCED_FADE_MS - 1))
      const coverStatus = yield* Fiber.status(coverFiber)
      expect(coverStatus._tag).toBe('Suspended')

      yield* TestClock.adjust(Duration.millis(1))
      const coverResult = yield* Fiber.join(coverFiber)
      expect(coverResult).toBe(true)

      // Reveal under reduced motion
      const revealFiber = yield* Effect.fork(veil.reveal())
      yield* TestClock.adjust(Duration.millis(REDUCED_FADE_MS - 1))
      const revealStatus = yield* Fiber.status(revealFiber)
      expect(revealStatus._tag).toBe('Suspended')

      yield* TestClock.adjust(Duration.millis(1))
      yield* Fiber.join(revealFiber)
      expect(veil.element.style.pointerEvents).toBe('none')

      yield* Scope.close(scope, Exit.void)
    }).pipe(runTest)

    overlay.remove()
  })

  it('when the overlay throws on insert, cover() returns false (edge becomes a cut)', async () => {
    const throwingOverlay = {
      firstChild: null,
      insertBefore: () => {
        throw new Error('Insert failed!')
      },
      removeChild: () => {},
      contains: () => false,
    } as unknown as HTMLElement

    await Effect.gen(function* () {
      const scope = yield* Scope.make()
      const veil = yield* makeVeil({
        overlay: throwingOverlay,
        reducedMotion: () => false,
      }).pipe(Scope.extend(scope))

      const result = yield* veil.cover()
      expect(result).toBe(false)

      yield* Scope.close(scope, Exit.void)
    }).pipe(runTest)
  })

  it('closing the scope removes the element', async () => {
    const overlay = document.createElement('div')
    document.body.appendChild(overlay)

    await Effect.gen(function* () {
      const scope = yield* Scope.make()
      const veil = yield* makeVeil({
        overlay,
        reducedMotion: () => false,
      }).pipe(Scope.extend(scope))

      expect(overlay.contains(veil.element)).toBe(true)

      yield* Scope.close(scope, Exit.void)
      expect(overlay.contains(veil.element)).toBe(false)
    }).pipe(runTest)

    overlay.remove()
  })
})
