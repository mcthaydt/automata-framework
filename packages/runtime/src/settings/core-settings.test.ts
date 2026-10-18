import { describe, expect, it } from 'vitest'
import { AUDIO_SETTINGS_DEFAULT, audioSettingsSchema } from './audio-settings.schema.js'
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
    const defaults = {
      input: { profile: '', overrides: {} },
      display: { quality: 'high' },
      audio: AUDIO_SETTINGS_DEFAULT,
    }
    expect(CORE_SETTINGS.defaults).toEqual(defaults)
    expect(readSettings(CORE_SETTINGS, null)).toEqual(defaults)
    expect(readSettings(CORE_SETTINGS, '{"version":1,"input":3,"display":"x"}')).toEqual(defaults)
  })

  it('keeps a saved input and display', () => {
    const saved = {
      input: { profile: 'jumper', overrides: { 'jump-0': { keys: ['KeyK'] } } },
      display: { quality: 'low' as const },
      audio: AUDIO_SETTINGS_DEFAULT,
    }
    expect(readSettings(CORE_SETTINGS, writeSettings(CORE_SETTINGS, saved))).toEqual(saved)
  })

  // M5.4: the Audio group's choices (M5 spec §7), FloorFifty's `audio` settings.
  it('reads a record saved before audio with audio at its defaults: not muted, every bus at full', () => {
    const before = '{"version":1,"input":{"profile":"","overrides":{}},"display":{"quality":"low"}}'
    expect(readSettings(CORE_SETTINGS, before).audio).toEqual({
      muted: false,
      muteUnfocused: false,
      gains: { master: 1, music: 1, sfx: 1, ui: 1, voice: 1 },
    })
    expect(readSettings(CORE_SETTINGS, before).display.quality).toBe('low')
  })

  it('keeps a saved audio record, and reads a bad one as the defaults without losing the rest', () => {
    const audio = {
      muted: true,
      muteUnfocused: true,
      gains: { master: 0.5, music: 0, sfx: 1, ui: 0.25, voice: 1 },
    }
    const saved = { input: { profile: '', overrides: {} }, display: { quality: 'high' as const }, audio }
    expect(readSettings(CORE_SETTINGS, writeSettings(CORE_SETTINGS, saved)).audio).toEqual(audio)
    const bad =
      '{"version":1,"input":{"profile":"","overrides":{}},"display":{"quality":"low"},"audio":{"gains":{"music":7}}}'
    expect(readSettings(CORE_SETTINGS, bad)).toMatchObject({
      display: { quality: 'low' },
      audio: AUDIO_SETTINGS_DEFAULT,
    })
  })

  it('fills a partial audio record field by field', () => {
    expect(audioSettingsSchema.parse({ muted: true })).toEqual({ ...AUDIO_SETTINGS_DEFAULT, muted: true })
  })
})
