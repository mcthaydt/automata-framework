import { Effect, Exit, SubscriptionRef } from 'effect'
import { describe, expect, it } from 'vitest'
import { RebindConflict } from '#src/features/input/bindings/rebind.ts'
import { makeInput } from '#src/features/input/input.manager.ts'
import { type InputProfile, inputProfileSchema } from '#src/features/input/input-profile.schema.ts'
import { makePresentationBus } from '#src/shared/runtime/presentation/presentation-bus.manager.ts'
import type { SettingsStore } from '#src/shared/runtime/settings/settings.manager.ts'
import { runScoped } from '../../../src/testing/host/page/run.ts'

// The Input's bindings follow the player's (M4 spec §4.5, §5 "Rebind"): the game's profile with the saved
// overrides from the settings' `input` field, rebound through `rebind` and `resetBindings`, which write the settings
// (memory first, then the host). Every Input on the same settings follows a change at once.

const profile: InputProfile = inputProfileSchema.parse({
  id: 'jumper',
  bindings: {
    jump: { keys: ['Space'], pad: [0] },
    fire: { keys: ['KeyF'], pad: [2], required: true },
  },
})

/** A settings store in memory, as `createSettings` keeps it before the host write. */
function memoryStore(
  initial: Record<string, unknown> = {},
): SettingsStore<unknown> & { readonly writes: unknown[] } {
  let value: unknown = initial
  const listeners = new Set<(value: unknown) => void>()
  const writes: unknown[] = []
  return {
    writes,
    get: () => value,
    subscribe(listener) {
      listeners.add(listener)
      listener(value)
      return () => void listeners.delete(listener)
    },
    update(change) {
      value = change(value)
      writes.push(value)
      for (const listener of [...listeners]) listener(value)
    },
  }
}

const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }))
const lift = (code: string) => window.dispatchEvent(new KeyboardEvent('keyup', { code }))
const held = (input: { held(): ReadonlySet<string> }) => [...input.held()]

describe('Input bindings from the settings', () => {
  it('applies the saved overrides over the game’s profile', () =>
    runScoped(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        const settings = memoryStore({
          input: { profile: 'jumper', overrides: { jump: { keys: ['KeyK'] } } },
        })
        const input = yield* makeInput({ target: window, profile, bus, settings })
        press('Space')
        expect(held(input)).toEqual([])
        lift('Space')
        press('KeyK')
        expect(held(input)).toEqual(['jump'])
        lift('KeyK')
        expect((yield* SubscriptionRef.get(input.profile)).bindings.jump?.keys).toEqual(['KeyK'])
      }),
    ))

  it('rebinds into the settings, publishes the change and updates the profile', () =>
    runScoped(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        const facts: unknown[] = []
        bus.subscribe('input.bindings.changed', (fact) => facts.push(fact))
        const settings = memoryStore({ display: { quality: 'low' } })
        const input = yield* makeInput({ target: window, profile, bus, settings })
        yield* input.rebind('jump', 'keyboard', { code: 'KeyK' })
        expect(settings.get()).toEqual({
          display: { quality: 'low' },
          input: { profile: 'jumper', overrides: { jump: { keys: ['KeyK'] } } },
        })
        expect(facts).toEqual([{ action: 'jump' }])
        expect((yield* SubscriptionRef.get(input.profile)).bindings.jump?.keys).toEqual(['KeyK'])
        press('KeyK')
        expect(held(input)).toEqual(['jump'])
        lift('KeyK')
      }),
    ))

  it('is followed by every Input on the same settings', () =>
    runScoped(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        const settings = memoryStore()
        const menu = yield* makeInput({ target: window, profile, bus, settings })
        const play = yield* makeInput({ target: window, profile, bus, settings })
        yield* menu.rebind('jump', 'keyboard', { code: 'KeyK' })
        press('KeyK')
        expect(held(play)).toEqual(['jump'])
        lift('KeyK')
      }),
    ))

  it('resets every binding to the game’s profile', () =>
    runScoped(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        const settings = memoryStore({
          input: { profile: 'jumper', overrides: { jump: { keys: ['KeyK'] } } },
        })
        const input = yield* makeInput({ target: window, profile, bus, settings })
        yield* input.resetBindings
        expect(settings.get()).toEqual({ input: { profile: 'jumper', overrides: {} } })
        expect(yield* SubscriptionRef.get(input.profile)).toEqual(profile)
      }),
    ))

  it('releases what was held when the bindings change', () =>
    runScoped(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        const input = yield* makeInput({ target: window, profile, bus, settings: memoryStore() })
        press('Space')
        expect(held(input)).toEqual(['jump'])
        yield* input.rebind('jump', 'keyboard', { code: 'KeyK' })
        expect(held(input)).toEqual([])
        lift('Space')
      }),
    ))

  it('refuses a rebind that would leave a required action unbound, and changes nothing (I-l)', () =>
    runScoped(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        const settings = memoryStore()
        const input = yield* makeInput({ target: window, profile, bus, settings })
        const exit = yield* Effect.exit(input.rebind('jump', 'keyboard', { code: 'KeyF' }))
        expect(exit).toEqual(Exit.fail(new RebindConflict({ action: 'jump', with: 'fire' })))
        expect(settings.writes).toEqual([])
        expect(yield* SubscriptionRef.get(input.profile)).toEqual(profile)
      }),
    ))

  it('keeps a rebind for this Input alone without settings', () =>
    runScoped(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        const input = yield* makeInput({ target: window, profile, bus })
        yield* input.rebind('jump', 'keyboard', { code: 'KeyK' })
        press('KeyK')
        expect(held(input)).toEqual(['jump'])
        lift('KeyK')
      }),
    ))
})
