import { describe, expect, it } from 'vitest'
import {
  INPUT_SETTINGS_DEFAULT,
  inputSettingsSchema,
} from '#src/features/input/bindings/input-settings.schema.ts'
import { applyOverrides } from '#src/features/input/bindings/rebind.ts'
import { type InputProfile, inputProfileSchema } from '#src/features/input/input-profile.schema.ts'

// Saved bindings (M4 spec §4.5, §6): the player's overrides over the game's profile, kept in the game's settings as
// `input`. Only what changed is stored, so a game update that adds an action keeps the player's other bindings, and a
// bad override is dropped while the defaults stand.

const profile: InputProfile = inputProfileSchema.parse({
  id: 'jumper',
  bindings: {
    jump: { keys: ['Space'], pad: [0] },
    fire: { keys: ['KeyF'], pad: [2] },
  },
})

describe('inputSettingsSchema', () => {
  it('reads a saved record', () => {
    const saved = { profile: 'jumper', overrides: { jump: { keys: ['KeyK'] } }, touchMode: 'swipe' }
    expect(inputSettingsSchema.parse(saved)).toEqual(saved)
  })

  it('reads a malformed record as the default', () => {
    expect(inputSettingsSchema.parse('nonsense')).toEqual(INPUT_SETTINGS_DEFAULT)
    expect(inputSettingsSchema.parse({ profile: 3 })).toEqual(INPUT_SETTINGS_DEFAULT)
    expect(INPUT_SETTINGS_DEFAULT).toEqual({ profile: '', overrides: {} })
  })
})

describe('applyOverrides', () => {
  it('applies the overrides over the defaults, field by field', () => {
    const { profile: applied, dropped } = applyOverrides(profile, {
      profile: 'jumper',
      overrides: { jump: { keys: ['KeyK'] }, fire: { pad: [3] } },
    })
    expect(dropped).toEqual([])
    expect(applied.bindings.jump).toEqual({ ...profile.bindings.jump, keys: ['KeyK'] })
    expect(applied.bindings.fire).toEqual({ ...profile.bindings.fire, pad: [3] })
  })

  it('drops an override for an unknown action, a reserved input or a pad button out of range, and keeps the rest', () => {
    const { profile: applied, dropped } = applyOverrides(profile, {
      profile: 'jumper',
      overrides: {
        dash: { keys: ['KeyD'] },
        jump: { keys: ['Escape'] },
        fire: { pad: [8] },
      },
    })
    expect(dropped).toEqual(['dash', 'fire', 'jump'])
    expect(applied).toEqual(profile)
  })

  it('drops a pad button out of the standard range', () => {
    const { profile: applied, dropped } = applyOverrides(profile, {
      profile: 'jumper',
      overrides: { jump: { pad: [17] } },
    })
    expect(dropped).toEqual(['jump'])
    expect(applied.bindings.jump?.pad).toEqual([0])
  })

  it('drops every override saved against another profile', () => {
    const { profile: applied, dropped } = applyOverrides(profile, {
      profile: 'other',
      overrides: { jump: { keys: ['KeyK'] } },
    })
    expect(dropped).toEqual(['jump'])
    expect(applied).toEqual(profile)
  })

  it('applies nothing from the default record', () => {
    expect(applyOverrides(profile, INPUT_SETTINGS_DEFAULT)).toEqual({ profile, dropped: [] })
  })
})
