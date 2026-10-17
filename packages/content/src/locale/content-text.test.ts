import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { createContentText } from './content-text'

// PRODUCT spec §4 item 5, after FloorFifty apps/client/src/i18n/content.ts (ac72660): authored TOML text is
// looked up at run time by its message key, in the active locale.
describe('createContentText', () => {
  const messages = {
    content_stage_snow_shrine_display_name: () => 'Sanctuaire',
    content_weapon_melee_sword_info_display_name: () => 'Épée',
    content_tutorial_steps_0_prompt: (inputs?: { glyph?: string }) => `Appuie sur ${inputs?.glyph}`,
  }

  it('answers an item’s text from its message', () => {
    const text = createContentText(messages)
    expect(text('stage', 'snow-shrine', ['displayName'], 'Snow Shrine')).toBe('Sanctuaire')
    expect(text('weapon', 'melee/sword', ['info', 'displayName'], 'Sword')).toBe('Épée')
  })

  it('passes inputs to the message, and a single document has no ID', () => {
    const text = createContentText(messages)
    expect(text('tutorial', undefined, ['steps', 0, 'prompt'], 'Press {glyph}', { glyph: 'A' })).toBe(
      'Appuie sur A',
    )
  })

  it('falls back to the authored text for a key with no message, and reports each key once', () => {
    const onMissing = vi.fn()
    const text = createContentText(messages, { onMissing })
    expect(text('stage', 'new-stage', ['displayName'], 'New Stage')).toBe('New Stage')
    expect(text('stage', 'new-stage', ['displayName'], 'New Stage')).toBe('New Stage')
    expect(onMissing).toHaveBeenCalledTimes(1)
    expect(onMissing).toHaveBeenCalledWith('content_stage_new_stage_display_name')
  })
})

// The subpath a browser bundle imports, so nothing under it may reach for Node.
describe('@mcthaydt/automata-content/locale', () => {
  it('imports no Node module, directly or through the files it imports', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const seen = new Set<string>()
    const visit = (file: string): void => {
      if (seen.has(file)) return
      seen.add(file)
      const source = readFileSync(file, 'utf8')
      for (const [, specifier] of source.matchAll(/^(?:import|export)\b[^\n]*from '([^']+)'/gm)) {
        expect(specifier, file).not.toMatch(/^node:/)
        if (specifier?.startsWith('.')) visit(`${resolve(dirname(file), specifier)}.ts`)
      }
    }
    visit(join(here, 'index.ts'))
    expect(seen.size).toBeGreaterThan(1)
  })

  it('is exported by the package for the workspace and for the published build', () => {
    const manifest = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
    ) as { exports: Record<string, string>; publishConfig: { exports: Record<string, { import: string }> } }
    expect(manifest.exports['./locale']).toBe('./src/locale/index.ts')
    expect(manifest.publishConfig.exports['./locale']?.import).toBe('./dist/locale.js')
  })
})
