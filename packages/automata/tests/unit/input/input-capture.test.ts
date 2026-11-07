import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RebindCancelled, RebindTimedOut } from '#src/features/input/bindings/rebind.ts'
import { createInput, REBIND_TIMEOUT_MS } from '#src/features/input/input.manager.ts'
import { type InputProfile, inputProfileSchema } from '#src/features/input/input-profile.schema.ts'
import { disposables } from '#src/shared/lib/disposables.ts'
import { ok, refused } from '#src/shared/lib/result.ts'
import { createPresentationBus } from '#src/shared/runtime/presentation/presentation-bus.manager.ts'
import { type FakeClock, fakeClock } from '#src/testing/fake-clock.ts'
import { settle } from '#src/testing/settle.ts'

// Each test's Inputs and buses, taken down after it.
let owned = disposables()
afterEach(() => {
  owned.dispose()
  owned = disposables()
})
const own = <T extends { dispose(): unknown }>(thing: T): T => {
  owned.add(() => void thing.dispose())
  return thing
}

// Capture (M4 spec §4.5, §6, I-k): the next key or pad button the player presses. Escape or pad B cancels it; nothing
// for `REBIND_TIMEOUT_MS` (10 s, on the Input's clock) times it out; neither changes a binding. While it waits, the
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

const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }))

/** Whether `promise` is still waiting once the queued callbacks have run. */
const pending = async (promise: Promise<unknown>): Promise<boolean> => {
  let done = false
  void promise.then(() => {
    done = true
  })
  await settle()
  return !done
}

/** The clock the Input times captures on; time stands still until a test moves it. */
let clock: FakeClock

/** Runs `body` with an Input over `window`, timed by a fresh fake clock. */
const run = async (body: (input: ReturnType<typeof createInput>) => Promise<void>): Promise<void> => {
  clock = fakeClock()
  const bus = own(createPresentationBus())
  await body(own(createInput({ target: window, profile, bus, clock })))
}

describe('Input.capture', () => {
  it('takes the next key, which reaches no other listener', () =>
    run(async (input) => {
      const others: string[] = []
      const other = (event: KeyboardEvent) => others.push(event.code)
      window.addEventListener('keydown', other)
      const waiting = input.capture('keyboard')
      press('KeyK')
      expect(await waiting).toEqual(ok({ code: 'KeyK' }))
      press('KeyJ')
      window.removeEventListener('keydown', other)
      expect(others).toEqual(['KeyJ'])
    }))

  it('is cancelled by Escape, which reaches no other listener (I-k)', () =>
    run(async (input) => {
      let escaped = false
      const other = () => {
        escaped = true
      }
      window.addEventListener('keydown', other)
      const waiting = input.capture('keyboard')
      press('Escape')
      expect(await waiting).toEqual(refused(new RebindCancelled({ device: 'keyboard' })))
      window.removeEventListener('keydown', other)
      expect(escaped).toBe(false)
    }))

  it('times out after 10 s with nothing pressed, and the bindings stay as they were (I-k)', () =>
    run(async (input) => {
      expect(REBIND_TIMEOUT_MS).toBe(10_000)
      const waiting = input.capture('keyboard')
      clock.advance(REBIND_TIMEOUT_MS - 1)
      expect(await pending(waiting)).toBe(true)
      clock.advance(1)
      expect(await waiting).toEqual(refused(new RebindTimedOut({ device: 'keyboard' })))
      expect(input.profile.get()).toEqual(profile)
      // The listener went with it: a later key is the Input's again.
      press('Space')
      expect([...input.held()]).toEqual(['jump'])
    }))

  it('takes a pad button from its press, never one held since before the capture', () =>
    run(async (input) => {
      buttons[0] = true
      input.poll()
      const waiting = input.capture('gamepad')
      input.poll()
      expect(await pending(waiting)).toBe(true)
      buttons[0] = false
      input.poll()
      buttons[3] = true
      input.poll()
      expect(await waiting).toEqual(ok({ button: 3 }))
    }))

  it('is cancelled by pad B (I-k)', () =>
    run(async (input) => {
      // The menu polls every frame, so the pad has been read before a capture starts.
      input.poll()
      const waiting = input.capture('gamepad')
      buttons[1] = true
      input.poll()
      expect(await waiting).toEqual(refused(new RebindCancelled({ device: 'gamepad' })))
    }))
})
