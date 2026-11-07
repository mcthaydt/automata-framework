import { describe, expect, it } from 'vitest'
import {
  applyOverrides,
  RebindConflict,
  RebindReserved,
  RebindUnknown,
  rebindProfile,
} from '#src/features/input/bindings/rebind.ts'
import { type InputProfile, inputProfileSchema } from '#src/features/input/input-profile.schema.ts'
import { refused } from '#src/shared/lib/result.ts'

// A rebind (M4 spec §4.5, M4-D4): the captured input becomes the action's only input on that device and leaves any
// other action live in the same context; if that would leave a required action unbound on that device, it is
// refused with both actions named and nothing changes.

const profileWith = (fire: object = {}): InputProfile =>
  inputProfileSchema.parse({
    id: 'jumper',
    bindings: {
      jump: { keys: ['Space'], pad: [0] },
      fire: { keys: ['KeyK'], pad: [2], ...fire },
      menu: { keys: ['KeyK'], context: 'menu' },
    },
  })

const overrides = (result: ReturnType<typeof rebindProfile>) => {
  if (!result.ok) throw new Error(`expected a rebind, got ${result.reason._tag}`)
  return result.value
}

describe('rebindProfile', () => {
  const defaults = profileWith()

  it('makes the captured key the action’s only key and keeps its pad buttons', () => {
    const next = overrides(rebindProfile(defaults, defaults, 'jump', 'keyboard', { code: 'KeyJ' }))
    expect(next).toEqual({ jump: { keys: ['KeyJ'] } })
    expect(
      applyOverrides(defaults, { profile: 'jumper', overrides: next }).profile.bindings.jump,
    ).toMatchObject({
      keys: ['KeyJ'],
      pad: [0],
    })
  })

  it('moves a key from the action that had it, which is left unbound (I-i)', () => {
    const next = overrides(rebindProfile(defaults, defaults, 'jump', 'keyboard', { code: 'KeyK' }))
    expect(next).toEqual({ jump: { keys: ['KeyK'] }, fire: { keys: [] } })
  })

  it('refuses to leave a required action unbound on that device, naming both (I-l)', () => {
    const required = profileWith({ required: true })
    const result = rebindProfile(required, required, 'jump', 'keyboard', { code: 'KeyK' })
    expect(result).toEqual(refused(new RebindConflict({ action: 'jump', with: 'fire' })))
  })

  it('moves a pad button the same way', () => {
    const next = overrides(rebindProfile(defaults, defaults, 'jump', 'gamepad', { button: 2 }))
    expect(next).toEqual({ jump: { pad: [2] }, fire: { pad: [] } })
  })

  it('leaves an action of another context its input', () => {
    const next = overrides(rebindProfile(defaults, defaults, 'jump', 'keyboard', { code: 'KeyK' }))
    expect(next.menu).toBeUndefined()
  })

  it('refuses a reserved input', () => {
    expect(rebindProfile(defaults, defaults, 'jump', 'keyboard', { code: 'Tab' })).toEqual(
      refused(new RebindReserved({ action: 'jump', input: 'Tab' })),
    )
    expect(rebindProfile(defaults, defaults, 'jump', 'gamepad', { button: 16 })).toEqual(
      refused(new RebindReserved({ action: 'jump', input: 'pad 16' })),
    )
  })

  it('refuses an action the profile does not have', () => {
    expect(rebindProfile(defaults, defaults, 'dash', 'keyboard', { code: 'KeyD' })).toEqual(
      refused(new RebindUnknown({ action: 'dash' })),
    )
  })

  it('keeps only what differs from the defaults: binding the default again leaves no override', () => {
    const moved = applyOverrides(defaults, {
      profile: 'jumper',
      overrides: overrides(rebindProfile(defaults, defaults, 'jump', 'keyboard', { code: 'KeyJ' })),
    }).profile
    expect(overrides(rebindProfile(defaults, moved, 'jump', 'keyboard', { code: 'Space' }))).toEqual({})
  })
})
