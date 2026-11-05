import { runScoped } from '@mcthaydt/automata-host/testing'
import { Effect, SubscriptionRef } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PadLike } from '#src/input/gamepad/read-pad.ts'
import { fakePad } from '#src/input/gamepad/testing/fake-pad.ts'
import { type Input, makeInput } from '#src/input/input.manager.ts'
import { type InputProfile, inputProfileSchema } from '#src/input/input-profile.schema.ts'
import { makePresentationBus } from '#src/presentation/presentation-bus.manager.ts'

// Analog play input for 3D (M4 spec §16.3.4): the touch move stick as the left stick, and the camera drag's pixels
// sampled once per step. Nothing here reaches the sim but integers: the stick is quantized (M4-D2) and the game turns
// the drag into turn units.

const thirdPerson: InputProfile = inputProfileSchema.parse({
  id: 'third-person',
  bindings: {
    forward: { keys: ['KeyW'], stick: ['left-up'] },
    'camera-turn': { gesture: ['camera-drag'] },
    inventory: { keys: ['KeyI'], context: 'menu' },
  },
})

let pads: (PadLike | null)[] = []
beforeEach(() => {
  pads = []
  Object.defineProperty(window.navigator, 'getGamepads', { configurable: true, value: () => pads })
})
afterEach(() => {
  Reflect.deleteProperty(window.navigator, 'getGamepads')
  Reflect.deleteProperty(document, 'visibilityState')
})

const withInput = (body: (input: Input) => void, profile: InputProfile = thirdPerson) =>
  runScoped(
    Effect.gen(function* () {
      const bus = yield* makePresentationBus()
      body(yield* makeInput({ target: window, profile, bus }))
    }),
  )

describe('Input camera drag (M4.12)', () => {
  it('reads the pixels dragged since the previous poll, once (A-d)', () =>
    withInput((input) => {
      expect(input.cameraDrag()).toBe(0)
      input.drag.drag(30, 'touch')
      input.drag.drag(12, 'touch')
      expect(input.cameraDrag()).toBe(0)
      input.poll(0)
      expect(input.cameraDrag()).toBe(42)
      input.poll(16)
      expect(input.cameraDrag()).toBe(0)
      input.drag.drag(-5, 'mouse')
      input.poll(32)
      expect(input.cameraDrag()).toBe(-5)
    }))

  it('follows the device that dragged: a finger is touch, the mouse is keyboard and mouse', () =>
    withInput((input) => {
      input.drag.drag(3, 'touch')
      expect(Effect.runSync(SubscriptionRef.get(input.device)).device).toBe('touch')
      input.drag.drag(3, 'mouse')
      expect(Effect.runSync(SubscriptionRef.get(input.device)).device).toBe('keyboard')
    }))

  it('is 0 when no action binds camera-drag (A-h)', () =>
    withInput(
      (input) => {
        input.drag.drag(30, 'touch')
        input.poll(0)
        expect(input.cameraDrag()).toBe(0)
      },
      inputProfileSchema.parse({ id: 'no-drag', bindings: { forward: { keys: ['KeyW'] } } }),
    ))

  it('is 0 in a menu when the drag is bound for play (A-h)', () =>
    withInput((input) => {
      input.setContext('menu')
      input.drag.drag(30, 'touch')
      input.poll(0)
      expect(input.cameraDrag()).toBe(0)
    }))

  it('drops a delta that is not a finite number (A-j)', () =>
    withInput((input) => {
      input.drag.drag(Number.NaN, 'touch')
      input.drag.drag(Number.POSITIVE_INFINITY, 'touch')
      input.drag.drag(4, 'touch')
      input.poll(0)
      expect(input.cameraDrag()).toBe(4)
    }))

  it('clears the drag on blur, on the page hiding and on a context change (A-i)', () =>
    withInput((input) => {
      input.drag.drag(10, 'touch')
      input.poll(0)
      input.drag.drag(7, 'touch')
      window.dispatchEvent(new Event('blur'))
      expect(input.cameraDrag()).toBe(0)
      input.poll(16)
      expect(input.cameraDrag()).toBe(0)

      input.drag.drag(7, 'touch')
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
      input.poll(32)
      expect(input.cameraDrag()).toBe(0)

      input.drag.drag(7, 'touch')
      input.setContext('menu')
      input.setContext('play')
      input.poll(48)
      expect(input.cameraDrag()).toBe(0)
    }))
})

describe('Input touch move stick (M4.12)', () => {
  it('is the left stick while held, quantized, and holds its directions (A-e)', () =>
    withInput((input) => {
      input.touchStick.set(0, -1)
      expect(input.stick('left')).toEqual({ x: 0, y: -127 })
      expect([...input.held()]).toEqual(['forward'])
      expect(Effect.runSync(SubscriptionRef.get(input.device)).device).toBe('touch')
      input.touchStick.set(0.5, 0)
      expect(input.stick('left')).toEqual({ x: 64, y: 0 })
      expect([...input.held()]).toEqual([])
    }))

  it('reads centred and holds nothing inside the dead zone (A-e)', () =>
    withInput((input) => {
      input.touchStick.set(0.2, 0)
      expect(input.stick('left')).toEqual({ x: 0, y: 0 })
      expect([...input.held()]).toEqual([])
    }))

  it('wins over the pad while held, and gives the pad’s stick back on release (A-e)', () =>
    withInput((input) => {
      pads = [fakePad().stick(0.9, 0)]
      input.poll(0)
      expect(input.stick('left')).toEqual({ x: 114, y: 0 })
      input.touchStick.set(-1, 0)
      expect(input.stick('left')).toEqual({ x: -127, y: 0 })
      input.touchStick.release()
      expect(input.stick('left')).toEqual({ x: 114, y: 0 })
    }))

  it('keeps an action held by the stick and a key until both let go', () =>
    withInput((input) => {
      input.touchStick.set(0, -1)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
      input.touchStick.release()
      expect([...input.held()]).toEqual(['forward'])
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
      expect([...input.held()]).toEqual([])
    }))

  it('lets go on blur and on a context change (A-i)', () =>
    withInput((input) => {
      input.touchStick.set(0, -1)
      window.dispatchEvent(new Event('blur'))
      expect(input.stick('left')).toEqual({ x: 0, y: 0 })
      expect([...input.held()]).toEqual([])

      input.touchStick.set(0, -1)
      input.setContext('menu')
      expect(input.stick('left')).toEqual({ x: 0, y: 0 })
      expect([...input.held()]).toEqual([])
    }))

  it('holds nothing for play in a menu, and holds again once moved back in play', () =>
    withInput((input) => {
      input.setContext('menu')
      input.touchStick.set(0, -1)
      expect([...input.held()]).toEqual([])
      input.setContext('play')
      input.touchStick.set(0, -0.9)
      expect([...input.held()]).toEqual(['forward'])
    }))
})
