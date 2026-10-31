import { describe, expect, it } from 'vitest'
import { tauriConfigSchema } from './tauri-config.schema.ts'

// DIST spec §6.3: a desktop game's `tauri` section. Tauri's identifier is reverse-DNS and must not end in `.app`
// (it clashes with the macOS bundle extension); https://v2.tauri.app/reference/config/#identifier.

describe('tauriConfigSchema', () => {
  it.each(['dev.mcthaydt.emberwick', 'com.example.my-game', 'io.itch.Cinder2'])(
    'accepts %s',
    (identifier) => {
      expect(tauriConfigSchema.safeParse({ identifier }).success).toBe(true)
    },
  )

  it.each([
    ['one part', 'emberwick'],
    ['an empty part', 'dev..emberwick'],
    ['an underscore', 'dev.my_game'],
    ['a leading digit in the first part', '1dev.game'],
    ['the .app ending', 'dev.mcthaydt.app'],
  ])('refuses an identifier with %s', (_why, identifier) => {
    expect(tauriConfigSchema.safeParse({ identifier }).success).toBe(false)
  })

  it('takes an optional icon, a .png path', () => {
    expect(tauriConfigSchema.safeParse({ identifier: 'dev.a.b', icon: 'art/icon.png' }).success).toBe(true)
    expect(tauriConfigSchema.safeParse({ identifier: 'dev.a.b', icon: 'art/icon.jpg' }).success).toBe(false)
  })
})
