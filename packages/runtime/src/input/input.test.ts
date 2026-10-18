import { runScoped } from '@mcthaydt/automata-host/testing'
import { Effect, Exit, Scope, SubscriptionRef } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makePresentationBus } from '../presentation/presentation-bus.manager.js'
import type { PadLike } from './gamepad/read-pad.js'
import { fakePad } from './gamepad/testing/fake-pad.js'
import { type HostInputMode, makeInput } from './input.manager.js'
import { type InputProfile, inputProfileSchema } from './input-profile.schema.js'

// The Input service (M4 spec §4.2): per-device held sets whose union is sampled once per fixed step. The
// bookkeeping comes from FloorFifty `apps/client/src/managers/input.ts` at `ac72660` (lines 42–60) and its
// `tests/client/managers/input.test.ts`: a keyup on one device never releases what another still holds.

const profile: InputProfile = inputProfileSchema.parse({
  id: 'test',
  bindings: {
    left: { keys: ['ArrowLeft', 'KeyA'], pad: [14], touch: true, gesture: ['swipe-left'] },
    drop: { gesture: ['flick-down'] },
    jump: { keys: ['Space'], pad: [0], touch: true },
    inventory: { keys: ['KeyI'], gesture: ['tap'], context: 'menu' },
    map: { keys: ['KeyM'], context: 'any' },
  },
})

const press = (code: string, repeat = false) =>
  window.dispatchEvent(new KeyboardEvent('keydown', { code, repeat, cancelable: true }))
const lift = (code: string) => window.dispatchEvent(new KeyboardEvent('keyup', { code }))

let buttons: boolean[] = []
let mapping = 'standard'
/** Set to drive the pads with `fakePad`s instead of the bare `buttons` pad. */
let pads: (PadLike | null)[] | undefined
beforeEach(() => {
  buttons = []
  mapping = 'standard'
  pads = undefined
  Object.defineProperty(window.navigator, 'getGamepads', {
    configurable: true,
    value: () =>
      pads ?? [
        {
          id: 'Standard Gamepad',
          index: 0,
          connected: true,
          mapping,
          axes: [0, 0, 0, 0],
          buttons: buttons.map((pressed) => ({ pressed, value: pressed ? 1 : 0 })),
        },
      ],
  })
})
afterEach(() => {
  Reflect.deleteProperty(window.navigator, 'getGamepads')
  Reflect.deleteProperty(document, 'visibilityState')
})

/** Runs `body` with an Input over `window` in a fresh scope. */
const withInput = (
  body: (input: Effect.Effect.Success<ReturnType<typeof makeInput>>) => void,
  withProfile: InputProfile = profile,
) =>
  runScoped(
    Effect.gen(function* () {
      const bus = yield* makePresentationBus()
      const input = yield* makeInput({ target: window, profile: withProfile, bus })
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
})

describe('Input gestures (M4.3)', () => {
  /** One fixed step's sample, as the app loop takes it: poll, then read what is held. */
  const sample = (input: Effect.Effect.Success<ReturnType<typeof makeInput>>): string[] => {
    input.poll()
    return [...input.held()]
  }

  it('holds the actions of a held gesture until it is released, as touch', () =>
    withInput((input) => {
      input.gesture.hold('swipe-left')
      expect(sample(input)).toEqual(['left'])
      expect(sample(input)).toEqual(['left'])
      expect(Effect.runSync(SubscriptionRef.get(input.device))).toEqual({
        device: 'touch',
        glyphs: 'generic',
      })
      input.gesture.release('swipe-left')
      expect(sample(input)).toEqual([])
    }))

  it('keeps an action held by a gesture while a key still holds it', () =>
    withInput((input) => {
      press('ArrowLeft')
      input.gesture.hold('swipe-left')
      input.gesture.release('swipe-left')
      expect(sample(input)).toEqual(['left'])
    }))

  it('shows a pulse to exactly one sample', () =>
    withInput((input) => {
      input.gesture.pulse('flick-down')
      expect(sample(input)).toEqual(['drop'])
      expect(sample(input)).toEqual([])
    }))

  it('never loses a pulse that lands between two samples', () =>
    withInput((input) => {
      expect(sample(input)).toEqual([])
      input.gesture.pulse('flick-down')
      expect(sample(input)).toEqual(['drop'])
      input.gesture.pulse('flick-down')
      expect(sample(input)).toEqual(['drop'])
      expect(sample(input)).toEqual([])
    }))

  it('gives two pulses before one sample that one sample', () =>
    withInput((input) => {
      input.gesture.pulse('flick-down')
      input.gesture.pulse('flick-down')
      expect(sample(input)).toEqual(['drop'])
      expect(sample(input)).toEqual([])
    }))

  it('holds nothing for an unbound gesture', () =>
    withInput((input) => {
      input.gesture.hold('swipe-up')
      input.gesture.pulse('swipe-down')
      expect(sample(input)).toEqual([])
    }))

  it('releases a held gesture on blur', () =>
    withInput((input) => {
      input.gesture.hold('swipe-left')
      window.dispatchEvent(new Event('blur'))
      expect(sample(input)).toEqual([])
    }))

  it('does not hold a menu action from a gesture in play', () =>
    withInput((input) => {
      input.gesture.pulse('tap')
      expect(sample(input)).toEqual([])
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
        expect(yield* SubscriptionRef.get(input.device)).toEqual({ device: 'keyboard', glyphs: 'generic' })
        buttons[0] = true
        input.poll()
        input.poll()
        expect(yield* SubscriptionRef.get(input.device)).toEqual({ device: 'gamepad', glyphs: 'generic' })
        input.hold('left')
        press('Space')
        expect(yield* SubscriptionRef.get(input.device)).toEqual({ device: 'keyboard', glyphs: 'generic' })
        expect(facts).toEqual([
          { device: 'gamepad', glyphs: 'generic', previous: 'keyboard' },
          { device: 'touch', glyphs: 'generic', previous: 'gamepad' },
          { device: 'keyboard', glyphs: 'generic', previous: 'touch' },
        ])
        expect(yield* SubscriptionRef.get(input.profile)).toBe(profile)
      }),
    )
  })
})

/** Lets forked fibers (the host-mode watcher) run. */
const turns = Effect.forEach(Array.from({ length: 10 }), () => Effect.yieldNow(), { discard: true })

describe('Input under a host (M4 spec §4.2, §5 step 3)', () => {
  it('starts from the host’s input mode and follows it when it reports a pad, with the pad layout’s glyphs', async () => {
    await runScoped(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        const hostInput = yield* SubscriptionRef.make<HostInputMode>({ mode: 'touch' })
        const input = yield* makeInput({ target: window, profile, bus, hostInput })
        expect(yield* SubscriptionRef.get(input.device)).toEqual({ device: 'touch', glyphs: 'generic' })

        yield* SubscriptionRef.set(hostInput, {
          mode: 'gamepad',
          gamepad: { layout: 'xbox', connected: true },
        })
        yield* turns
        expect(yield* SubscriptionRef.get(input.device)).toEqual({ device: 'gamepad', glyphs: 'xbox' })

        yield* SubscriptionRef.set(hostInput, {
          mode: 'gamepad',
          gamepad: { layout: 'other', connected: true },
        })
        yield* turns
        expect(yield* SubscriptionRef.get(input.device)).toEqual({ device: 'gamepad', glyphs: 'generic' })

        // The last real input still wins.
        press('Space')
        expect(yield* SubscriptionRef.get(input.device)).toEqual({ device: 'keyboard', glyphs: 'generic' })
      }),
    )
  })

  it('starts on the keyboard when the host says keyboard and mouse', async () => {
    await runScoped(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        const hostInput = yield* SubscriptionRef.make<HostInputMode>({ mode: 'keyboard-mouse' })
        const input = yield* makeInput({ target: window, profile, bus, hostInput })
        expect((yield* SubscriptionRef.get(input.device)).device).toBe('keyboard')
      }),
    )
  })
})

const DUALSENSE = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'
const XBOX = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'
const plug = (type: 'gamepadconnected' | 'gamepaddisconnected', gamepad: PadLike) =>
  window.dispatchEvent(Object.assign(new Event(type), { gamepad }))

describe('Input hot-plug and the active pad (M4.2, I-e)', () => {
  it('lists connected pads and publishes input.pad.connected, saying when a pad is not standard', async () => {
    await runScoped(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        const facts: unknown[] = []
        bus.subscribe('input.pad.connected', (fact) => facts.push(fact))
        const input = yield* makeInput({ target: window, profile: padProfile, bus })
        plug('gamepadconnected', fakePad({ id: XBOX }))
        plug('gamepadconnected', fakePad({ id: 'Odd pad', index: 1, mapping: '' }))
        expect(yield* SubscriptionRef.get(input.pads)).toEqual([
          { index: 0, id: XBOX, standard: true },
          { index: 1, id: 'Odd pad', standard: false },
        ])
        expect(facts).toEqual([
          { index: 0, id: XBOX, standard: true },
          { index: 1, id: 'Odd pad', standard: false },
        ])
      }),
    )
  })

  it('makes a second pad active on its first press, with its glyph family', async () => {
    await runScoped(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        const input = yield* makeInput({ target: window, profile: padProfile, bus })
        pads = [fakePad({ id: XBOX }).press(14), fakePad({ id: DUALSENSE, index: 1 })]
        input.poll(0)
        expect(yield* SubscriptionRef.get(input.device)).toEqual({ device: 'gamepad', glyphs: 'xbox' })
        pads = [
          fakePad({ id: XBOX }).press(14),
          fakePad({ id: DUALSENSE, index: 1 }).stick(0, 0, 'left').press(0),
        ]
        input.poll(16)
        expect(yield* SubscriptionRef.get(input.device)).toEqual({ device: 'gamepad', glyphs: 'playstation' })
        expect([...input.held()]).toEqual(['left', 'jump'])
      }),
    )
  })

  it('releases what an unplugged pad held, drops it from pads and publishes input.pad.disconnected', async () => {
    await runScoped(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        const facts: unknown[] = []
        bus.subscribe('input.pad.disconnected', (fact) => facts.push(fact))
        const input = yield* makeInput({ target: window, profile: padProfile, bus })
        const xbox = fakePad({ id: XBOX })
        plug('gamepadconnected', xbox)
        pads = [xbox.press(14).stick(-0.9, 0)]
        input.poll(0)
        expect([...input.held()]).toEqual(['left'])
        pads = [null]
        plug('gamepaddisconnected', xbox)
        expect([...input.held()]).toEqual([])
        expect(input.stick('left')).toEqual({ x: 0, y: 0 })
        expect(yield* SubscriptionRef.get(input.pads)).toEqual([])
        expect(facts).toEqual([{ index: 0, id: XBOX, standard: true, wasActive: true }])
        plug('gamepadconnected', fakePad({ id: DUALSENSE, index: 1 }))
        plug('gamepaddisconnected', fakePad({ id: DUALSENSE, index: 1 }))
        expect(facts.at(-1)).toEqual({ index: 1, id: DUALSENSE, standard: true, wasActive: false })
      }),
    )
  })

  it('never lets a non-standard pad drive bindings', () =>
    withInput((input) => {
      pads = [fakePad({ mapping: '' }).press(14).stick(-0.9, 0)]
      input.poll(0)
      expect([...input.held()]).toEqual([])
    }, padProfile))
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

const padProfile: InputProfile = inputProfileSchema.parse({
  id: 'pad',
  bindings: {
    left: { keys: ['ArrowLeft'], pad: [14], stick: ['left-left'] },
    jump: { keys: ['Space'], pad: [0] },
  },
})

describe('Input sticks (M4.2, I-c)', () => {
  it('holds an action bound to a stick direction past the deadzone, and lets go inside it', () =>
    withInput((input) => {
      pads = [fakePad().stick(-0.5, 0)]
      input.poll(0)
      expect([...input.held()]).toEqual(['left'])
      pads = [fakePad().stick(-0.1, 0)]
      input.poll(16)
      expect([...input.held()]).toEqual([])
    }, padProfile))

  it('keeps an action held by the D-pad and the stick until both let go', () =>
    withInput((input) => {
      pads = [fakePad().stick(-0.9, 0).press(14)]
      input.poll(0)
      pads = [fakePad().press(14)]
      input.poll(16)
      expect([...input.held()]).toEqual(['left'])
      pads = [fakePad()]
      input.poll(32)
      expect([...input.held()]).toEqual([])
    }, padProfile))

  it('reads the active pad’s stick, quantized, and centred inside the deadzone', () =>
    withInput((input) => {
      expect(input.stick('left')).toEqual({ x: 0, y: 0 })
      pads = [fakePad().stick(-0.5, 0).stick(0, 1, 'right')]
      input.poll(0)
      expect(input.stick('left')).toEqual({ x: -64, y: 0 })
      expect(input.stick('right')).toEqual({ x: 0, y: 127 })
      pads = [fakePad().stick(0.1, 0.1)]
      input.poll(16)
      expect(input.stick('left')).toEqual({ x: 0, y: 0 })
    }, padProfile))
})

describe('Input menu navigation from a pad (M4.2, I-d)', () => {
  it('repeats a held D-pad direction at 0, 400, 520 and 640 ms in menus', () =>
    withInput((input) => {
      const fired: number[] = []
      let now = 0
      input.setContext('menu')
      input.onPress('nav-down', () => fired.push(now))
      pads = [fakePad().press(13)]
      for (now = 0; now <= 700; now += 10) input.poll(now)
      expect(fired).toEqual([0, 400, 520, 640])
    }, padProfile))

  it('walks a menu with the left stick as with the D-pad, and fires once for a short press', () =>
    withInput((input) => {
      const fired: string[] = []
      input.setContext('menu')
      input.onPress('nav-up', () => fired.push('up'))
      pads = [fakePad().stick(0.3, -0.8)]
      input.poll(0)
      input.poll(200)
      pads = [fakePad()]
      input.poll(300)
      expect(fired).toEqual(['up'])
    }, padProfile))

  it('masks what the pad held across a context change until it is let go (the handover)', () =>
    withInput((input) => {
      const fired: string[] = []
      input.onPress('confirm', () => fired.push('confirm'))
      input.onPress('nav-down', () => fired.push('down'))
      pads = [fakePad().press(0).stick(0, 0.9)]
      input.poll(0)
      input.setContext('menu')
      for (let now = 16; now <= 1000; now += 16) input.poll(now)
      expect(fired).toEqual([])
      pads = [fakePad()]
      input.poll(1016)
      pads = [fakePad().press(0)]
      input.poll(1032)
      expect(fired).toEqual(['confirm'])
    }, padProfile))
})
