import { describe, expect, it } from 'vitest'
import { CORE_SETTINGS } from './core-settings.js'
import { readSettings, writeSettings } from './migrate-settings.js'

// The core settings (M4 spec §4.5, §4.8): what a game that declares no settings saves, so the Settings screen's
// Controls and Display sections always have somewhere to keep the player's choices.

describe('CORE_SETTINGS', () => {
  it('is the `settings` save, version 1', () => {
    expect(CORE_SETTINGS.key).toBe('settings')
    expect(CORE_SETTINGS.version).toBe(1)
  })

  it('reads its defaults from nothing, or from a record it cannot read', () => {
    const defaults = { input: { profile: '', overrides: {} }, display: { quality: 'high' } }
    expect(CORE_SETTINGS.defaults).toEqual(defaults)
    expect(readSettings(CORE_SETTINGS, null)).toEqual(defaults)
    expect(readSettings(CORE_SETTINGS, '{"version":1,"input":3,"display":"x"}')).toEqual(defaults)
  })

  it('keeps a saved input and display', () => {
    const saved = {
      input: { profile: 'jumper', overrides: { 'jump-0': { keys: ['KeyK'] } } },
      display: { quality: 'low' as const },
    }
    expect(readSettings(CORE_SETTINGS, writeSettings(CORE_SETTINGS, saved))).toEqual(saved)
  })
})
