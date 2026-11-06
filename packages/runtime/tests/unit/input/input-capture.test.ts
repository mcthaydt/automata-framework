import { Duration, Effect, Exit, Fiber, SubscriptionRef, TestClock, TestContext } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RebindCancelled, RebindTimedOut } from '#src/input/bindings/rebind.ts'
import { makeInput, REBIND_TIMEOUT_MS } from '#src/input/input.manager.ts'
import { type InputProfile, inputProfileSchema } from '#src/input/input-profile.schema.ts'
import { makePresentationBus } from '#src/presentation/presentation-bus.manager.ts'

// Capture (M4 spec §4.5, §6, I-k): the next key or pad button the player presses. Escape or pad B cancels it; nothing
// for `REBIND_TIMEOUT_MS` (10 s, on Effect's Clock) times it out; neither changes a binding. While it waits, the
// press it takes reaches nothing else, so the Escape that cancels does not also leave the screen.

const profile: InputProfile = inputProfileSchema.parse({
  id: 'jumper',
  bindings: { jump: { keys: ['Space'], pad: [0] } },
})

let buttons: boolean[] = []
beforeEach(() => {
  buttons = []
  Object.defineProperty(window.navigator, 'getGamepads', {
    configurable: true,
    value: () => [
      {
        id: 'Standard Gamepad',
        index: 0,
        connected: true,
        mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: buttons.map((pressed) => ({ pressed, value: pressed ? 1 : 0 })),
      },
    ],
  })
})
afterEach(() => Reflect.deleteProperty(window.navigator, 'getGamepads'))

/** Lets the forked capture start waiting: the test clock runs every fiber until it suspends. */
const settled = TestClock.adjust(Duration.zero)

const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }))

/** Runs `body` with an Input over `window`, under the test clock. */
const run = <A, E>(
  body: (input: Effect.Effect.Success<ReturnType<typeof makeInput>>) => Effect.Effect<A, E>,
) =>
  Effect.runPromise(
    Effect.provide(
      Effect.scoped(
        Effect.gen(function* () {
          const bus = yield* makePresentationBus()
          const input = yield* makeInput({ target: window, profile, bus })
          return yield* body(input)
        }),
      ),
      TestContext.TestContext,
    ),
  )

describe('Input.capture', () => {
  it('takes the next key, which reaches no other listener', () =>
    run((input) =>
      Effect.gen(function* () {
        const others: string[] = []
        const other = (event: KeyboardEvent) => others.push(event.code)
        window.addEventListener('keydown', other)
        const waiting = yield* Effect.fork(input.capture('keyboard'))
        yield* settled
        press('KeyK')
        expect(yield* Fiber.join(waiting)).toEqual({ code: 'KeyK' })
        press('KeyJ')
        window.removeEventListener('keydown', other)
        expect(others).toEqual(['KeyJ'])
      }),
    ))

  it('is cancelled by Escape, which reaches no other listener (I-k)', () =>
    run((input) =>
      Effect.gen(function* () {
        let escaped = false
        const other = () => {
          escaped = true
        }
        window.addEventListener('keydown', other)
        const waiting = yield* Effect.fork(input.capture('keyboard'))
        yield* settled
        press('Escape')
        expect(yield* Fiber.await(waiting)).toEqual(Exit.fail(new RebindCancelled({ device: 'keyboard' })))
        window.removeEventListener('keydown', other)
        expect(escaped).toBe(false)
      }),
    ))

  it('times out after 10 s with nothing pressed, and the bindings stay as they were (I-k)', () =>
    run((input) =>
      Effect.gen(function* () {
        expect(REBIND_TIMEOUT_MS).toBe(10_000)
        const waiting = yield* Effect.fork(input.capture('keyboard'))
        yield* TestClock.adjust(Duration.millis(REBIND_TIMEOUT_MS - 1))
        expect(waiting.unsafePoll()).toBeNull()
        yield* TestClock.adjust(Duration.millis(1))
        expect(yield* Fiber.await(waiting)).toEqual(Exit.fail(new RebindTimedOut({ device: 'keyboard' })))
        expect(yield* SubscriptionRef.get(input.profile)).toEqual(profile)
        // The listener went with it: a later key is the Input's again.
        press('Space')
        expect([...input.held()]).toEqual(['jump'])
      }),
    ))

  it('takes a pad button from its press, never one held since before the capture', () =>
    run((input) =>
      Effect.gen(function* () {
        buttons[0] = true
        input.poll()
        const waiting = yield* Effect.fork(input.capture('gamepad'))
        yield* settled
        input.poll()
        expect(waiting.unsafePoll()).toBeNull()
        buttons[0] = false
        input.poll()
        buttons[3] = true
        input.poll()
        expect(yield* Fiber.join(waiting)).toEqual({ button: 3 })
      }),
    ))

  it('is cancelled by pad B (I-k)', () =>
    run((input) =>
      Effect.gen(function* () {
        // The menu polls every frame, so the pad has been read before a capture starts.
        input.poll()
        const waiting = yield* Effect.fork(input.capture('gamepad'))
        yield* settled
        buttons[1] = true
        input.poll()
        expect(yield* Fiber.await(waiting)).toEqual(Exit.fail(new RebindCancelled({ device: 'gamepad' })))
      }),
    ))
})
