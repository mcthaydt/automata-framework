import { FakeHostHandle, HostingTest, runScoped } from '@mcthaydt/automata-host/testing'
import { settle } from '@ruken/sdk-host/testing'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { makePresentationBus } from '../presentation/presentation-bus.manager.js'
import { fakePad } from './gamepad/testing/fake-pad.js'
import { makeInput } from './input.manager.js'
import { RESERVED_PAD_BUTTONS } from './input-profile.schema.js'
import { MENU_BINDINGS, type MenuAction } from './menu-actions.js'

// The reserved pad button (M4-D3, M4 spec §4.3, Ruken request R-3). The vendored SDK's gamepad poller summons
// the host when a standard pad holds its View button for 600 ms. This drives that poller through the fake host
// with an injected pad and clock and reads the button from the `host.summon` it sends, so AF's reserved list
// follows the SDK's behavior rather than restating the number on its own authority.
const HOLD_MS = 700
const FRAME_MS = 16
/** The poller's own cadence (`createGamepadPoller`, `timers.setTimeout(tick, 50)`): driven by hand here. */
const SDK_POLL_MS = 50

describe('the reserved pad button, as the Ruken SDK behaves', () => {
  it('the SDK summons the host on a held button that AF reserves, and Input does nothing with it', async () => {
    let pressed = fakePad()
    let now = 0
    let polls: (() => void)[] = []
    const layer = HostingTest({
      env: (env) => ({
        ...env,
        hasFocus: () => true,
        getGamepads: () => [pressed],
        timers: {
          now: () => now,
          setTimeout: (callback, ms) => {
            if (ms !== SDK_POLL_MS) return env.timers.setTimeout(callback, ms)
            polls.push(callback)
            return undefined
          },
          clearTimeout: (handle) => env.timers.clearTimeout(handle),
        },
      }),
    })
    const advance = (ms: number): void => {
      const until = now + ms
      while (now < until) {
        now += SDK_POLL_MS
        const due = polls
        polls = []
        for (const poll of due) poll()
      }
    }

    await runScoped(
      Effect.gen(function* () {
        const handle = yield* FakeHostHandle
        // The candidate the SDK will report: hold each standard button in turn until one summons the host.
        let summoned: { button: number } | undefined
        for (let button = 0; button < 17 && summoned === undefined; button++) {
          pressed = fakePad().press(button)
          advance(HOLD_MS)
          pressed = fakePad()
          advance(SDK_POLL_MS)
          yield* Effect.promise(() => settle())
          summoned = handle.sentByGame('host.summon')[0] as { button: number } | undefined
        }
        expect(handle.sentByGame('host.summon')).toHaveLength(1)
        expect(RESERVED_PAD_BUTTONS).toContain(summoned?.button)

        const bus = yield* makePresentationBus()
        const input = yield* makeInput({ target: window, profile: { id: 'none', bindings: {} }, bus })
        const fired: string[] = []
        for (const action of Object.keys(MENU_BINDINGS) as MenuAction[])
          input.onPress(action, () => fired.push(action))
        Object.defineProperty(window.navigator, 'getGamepads', {
          configurable: true,
          value: () => [fakePad().press(summoned?.button ?? -1)],
        })
        try {
          for (const context of ['play', 'menu'] as const) {
            input.setContext(context)
            input.poll(0)
            input.poll(FRAME_MS)
          }
        } finally {
          Reflect.deleteProperty(window.navigator, 'getGamepads')
        }
        expect([...input.held()]).toEqual([])
        expect(fired).toEqual([])
      }).pipe(Effect.provide(layer)),
    )
  })
})
