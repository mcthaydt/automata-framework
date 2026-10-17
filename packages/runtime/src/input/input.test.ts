import { runScoped } from '@mcthaydt/automata-host/testing'
import { Effect, Exit, Scope, SubscriptionRef } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makePresentationBus } from '../presentation/presentation-bus.manager.js'
import { makeInput } from './input.manager.js'
import { type InputProfile, inputProfileSchema } from './input-profile.schema.js'

// The Input service (M4 spec §4.2): per-device held sets whose union is sampled once per fixed step. The
// bookkeeping comes from FloorFifty `apps/client/src/managers/input.ts` at `ac72660` (lines 42–60) and its
// `tests/client/managers/input.test.ts`: a keyup on one device never releases what another still holds.

const profile: InputProfile = inputProfileSchema.parse({
  id: 'test',
  bindings: {
    left: { keys: ['ArrowLeft', 'KeyA'], pad: [14], touch: true },
    jump: { keys: ['Space'], pad: [0], touch: true },
    inventory: { keys: ['KeyI'], context: 'menu' },
    map: { keys: ['KeyM'], context: 'any' },
  },
})

const press = (code: string, repeat = false) =>
  window.dispatchEvent(new KeyboardEvent('keydown', { code, repeat, cancelable: true }))
const lift = (code: string) => window.dispatchEvent(new KeyboardEvent('keyup', { code }))

let buttons: boolean[] = []
let mapping = 'standard'
beforeEach(() => {
  buttons = []
  mapping = 'standard'
  Object.defineProperty(window.navigator, 'getGamepads', {
    configurable: true,
    value: () => [{ index: 0, mapping, buttons: buttons.map((pressed) => ({ pressed })) }],
  })
})
afterEach(() => {
  Reflect.deleteProperty(window.navigator, 'getGamepads')
  Reflect.deleteProperty(document, 'visibilityState')
})

/** Runs `body` with an Input over `window` in a fresh scope. */
const withInput = (body: (input: Effect.Effect.Success<ReturnType<typeof makeInput>>) => void) =>
  runScoped(
    Effect.gen(function* () {
      const bus = yield* makePresentationBus()
      const input = yield* makeInput({ target: window, profile, bus })
      body(input)
    }),
  )

describe('Input held actions (I-b)', () => {
  it('keeps an action held while another device still holds it', () =>
    withInput((input) => {
      press('Space')
      buttons[0] = true
      input.poll()
      lift('Space')
      expect([...input.held()]).toEqual(['jump'])
      buttons[0] = false
      input.poll()
      expect([...input.held()]).toEqual([])
    }))

  it('keeps an action held while another key on the same device holds it', () =>
    withInput((input) => {
      press('ArrowLeft')
      press('KeyA')
      lift('ArrowLeft')
      expect([...input.held()]).toEqual(['left'])
    }))

  it('lists held actions in first-press order, which is the order toCommand merges in', () =>
    withInput((input) => {
      press('Space')
      press('ArrowLeft')
      expect([...input.held()]).toEqual(['jump', 'left'])
      lift('Space')
      press('Space')
      expect([...input.held()]).toEqual(['left', 'jump'])
    }))

  it('changes nothing on a key repeat', () =>
    withInput((input) => {
      press('Space')
      press('ArrowLeft')
      press('Space', true)
      expect([...input.held()]).toEqual(['jump', 'left'])
    }))

  it('stops a bound key scrolling the page, and leaves other keys alone', () =>
    withInput(() => {
      const bound = new KeyboardEvent('keydown', { code: 'Space', cancelable: true })
      const other = new KeyboardEvent('keydown', { code: 'KeyQ', cancelable: true })
      window.dispatchEvent(bound)
      window.dispatchEvent(other)
      expect(bound.defaultPrevented).toBe(true)
      expect(other.defaultPrevented).toBe(false)
    }))

  it('holds and releases a touch button by action', () =>
    withInput((input) => {
      input.hold('left')
      expect([...input.held()]).toEqual(['left'])
      input.release('left')
      expect([...input.held()]).toEqual([])
    }))

  it('releases the keyboard and touch on blur, and the pad re-asserts on its next poll', () =>
    withInput((input) => {
      press('ArrowLeft')
      input.hold('left')
      buttons[0] = true
      input.poll()
      window.dispatchEvent(new Event('blur'))
      expect([...input.held()]).toEqual(['jump'])
      input.poll()
      expect([...input.held()]).toEqual(['jump'])
    }))

  it('releases every device when the page is hidden', () =>
    withInput((input) => {
      press('ArrowLeft')
      buttons[0] = true
      input.poll()
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
      expect([...input.held()]).toEqual([])
    }))

  it('ignores a pad without the standard mapping', () =>
    withInput((input) => {
      mapping = ''
      buttons[0] = true
      input.poll()
      expect([...input.held()]).toEqual([])
    }))

  it('stick() is centred until M4.2 reads sticks', () =>
    withInput((input) => {
      expect(input.stick('left')).toEqual({ x: 0, y: 0 })
    }))
})

describe('Input context and menu actions', () => {
  it('in play, holds play and any actions, never menu ones', () =>
    withInput((input) => {
      press('KeyI')
      press('KeyM')
      expect([...input.held()]).toEqual(['map'])
    }))

  it('switching context releases what is held', () =>
    withInput((input) => {
      press('ArrowLeft')
      input.setContext('menu')
      expect([...input.held()]).toEqual([])
      press('KeyI')
      press('ArrowLeft')
      expect([...input.held()]).toEqual(['inventory'])
    }))

  it('fires a menu action once per press, only in menus; pause fires in play', () =>
    withInput((input) => {
      const fired: string[] = []
      input.onPress('confirm', () => fired.push('confirm'))
      input.onPress('pause', () => fired.push('pause'))
      press('Enter')
      press('Escape')
      expect(fired).toEqual(['pause'])
      lift('Escape')
      lift('Enter')
      input.setContext('menu')
      press('Enter')
      press('Enter', true)
      expect(fired).toEqual(['pause', 'confirm'])
    }))

  it('fires menu actions from pad buttons on the poll that first sees them pressed', () =>
    withInput((input) => {
      const fired: string[] = []
      input.setContext('menu')
      input.onPress('confirm', () => fired.push('confirm'))
      buttons[0] = true
      input.poll()
      input.poll()
      expect(fired).toEqual(['confirm'])
    }))

  it('stops calling a listener once it unsubscribes', () =>
    withInput((input) => {
      const fired: string[] = []
      const stop = input.onPress('pause', () => fired.push('pause'))
      stop()
      press('Escape')
      expect(fired).toEqual([])
    }))
})

describe('Input active device and profile', () => {
  it('follows the last real input and publishes input.device.changed once per change', async () => {
    await runScoped(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        const facts: unknown[] = []
        bus.subscribe('input.device.changed', (fact) => facts.push(fact))
        const input = yield* makeInput({ target: window, profile, bus })
        expect(yield* SubscriptionRef.get(input.device)).toBe('keyboard')
        buttons[0] = true
        input.poll()
        input.poll()
        expect(yield* SubscriptionRef.get(input.device)).toBe('gamepad')
        input.hold('left')
        press('Space')
        expect(yield* SubscriptionRef.get(input.device)).toBe('keyboard')
        expect(facts).toEqual([
          { device: 'gamepad', previous: 'keyboard' },
          { device: 'touch', previous: 'gamepad' },
          { device: 'keyboard', previous: 'touch' },
        ])
        expect(yield* SubscriptionRef.get(input.profile)).toBe(profile)
      }),
    )
  })
})

describe('Input scope', () => {
  it('stops listening when its scope closes', async () => {
    const scope = Effect.runSync(Scope.make())
    const input = Effect.runSync(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        return yield* makeInput({ target: window, profile, bus })
      }).pipe(Scope.extend(scope)),
    )
    Effect.runSync(Scope.close(scope, Exit.void))
    press('Space')
    expect([...input.held()]).toEqual([])
  })
})
