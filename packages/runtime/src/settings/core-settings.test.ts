import { describe, expect, it } from 'vitest'
import { AUDIO_SETTINGS_DEFAULT, audioSettingsSchema } from './audio-settings.schema.js'
import { CORE_SETTINGS } from './core-settings.js'
import { readSettings, writeAccountSettings, writeDeviceSettings, writeSettings } from './migrate-settings.js'

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
      haptics: { enabled: true },
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
      haptics: { enabled: false },
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
    const saved = {
      input: { profile: '', overrides: {} },
      display: { quality: 'high' as const },
      audio,
      haptics: { enabled: true },
    }
    // The audio record is the device's (M5-D4): read from there, and the account's copy is not read at all.
    expect(
      readSettings(
        CORE_SETTINGS,
        writeAccountSettings(CORE_SETTINGS, saved),
        writeDeviceSettings(CORE_SETTINGS, saved),
      ).audio,
    ).toEqual(audio)
    const account = '{"version":1,"input":{"profile":"","overrides":{}},"display":{"quality":"low"}}'
    const bad = '{"version":1,"audio":{"gains":{"music":7}}}'
    expect(readSettings(CORE_SETTINGS, account, bad)).toMatchObject({
      display: { quality: 'low' },
      audio: AUDIO_SETTINGS_DEFAULT,
    })
  })

  it('fills a partial audio record field by field', () => {
    expect(audioSettingsSchema.parse({ muted: true })).toEqual({ ...AUDIO_SETTINGS_DEFAULT, muted: true })
  })

  // M5.2 (M5 spec §4.5, M5-D4): the audio choices belong to the device, as FloorFifty's `keepAudioOnDevice` has it
  // (Owner, 2026-10-10: "muting a Mac must not mute the same player's iPad").
  it('keeps the audio choices on the device', () => {
    expect(CORE_SETTINGS.deviceFields).toEqual(['audio'])
  })

  it('reads an account record that still holds audio as the defaults on a device with none, and its own record where it has one', () => {
    const muted = {
      muted: true,
      muteUnfocused: false,
      gains: { master: 0.2, music: 1, sfx: 1, ui: 1, voice: 1 },
    }
    const account = JSON.stringify({ version: 1, display: { quality: 'low' }, audio: muted })
    expect(readSettings(CORE_SETTINGS, account, null)).toMatchObject({
      display: { quality: 'low' },
      audio: AUDIO_SETTINGS_DEFAULT,
    })
    const device = JSON.stringify({ version: 1, audio: { ...muted, muted: false } })
    expect(readSettings(CORE_SETTINGS, account, device).audio).toEqual({ ...muted, muted: false })
  })

  // Redo step 10 (Owner, 2026-10-18): the Vibration group's toggle, on until the player turns it off.
  it('keeps the Vibration setting, on by default and for a record saved before it or a bad one', () => {
    expect(readSettings(CORE_SETTINGS, '{"version":1}').haptics).toEqual({ enabled: true })
    expect(readSettings(CORE_SETTINGS, '{"version":1,"haptics":{"enabled":"no"}}').haptics).toEqual({
      enabled: true,
    })
    expect(readSettings(CORE_SETTINGS, '{"version":1,"haptics":{"enabled":false}}').haptics).toEqual({
      enabled: false,
    })
  })
})
