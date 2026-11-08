import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import type { EditorTokens } from '#src/shared/kit/tokens/editor-tokens.ts'

// The approved mockup's tool chrome (2026-11-06, `refactor/2026-11-06-redesign-mockups/editor-level.html`): one
// neutral palette for every editor screen, white panels on a near-white field, hairline separators, greys that read
// at 4.5:1 on white and on the chosen row's tint. `tool-chrome.css` puts it under the names the kit already reads,
// on the editor's own pages only, so the website keeps its own field.
const PACKAGE = new URL('../../../../../', import.meta.url)
const read = (relative: string): string => readFileSync(new URL(relative, PACKAGE), 'utf8')
const tokens = (JSON.parse(read('src/shared/kit/tokens/tokens.json')) as EditorTokens).tokens
const chrome = read('src/shared/kit/tool-chrome.css').replace(/\/\*[\s\S]*?\*\//g, '')

const hex = (name: string): string => {
  const value = tokens[name]
  if (value === undefined || !/^#[0-9a-f]{6}$/.test(value)) throw new Error(`no hex token ${name}`)
  return value
}
const channel = (value: number): number => {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = (color: string): number => {
  const n = Number.parseInt(color.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}
const contrast = (a: string, b: string): number => {
  const [light, dark] = [luminance(hex(a)), luminance(hex(b))].sort((x, y) => y - x)
  return ((light as number) + 0.05) / ((dark as number) + 0.05)
}

describe('the tool chrome', () => {
  test('puts the neutral palette under the names the kit reads', () => {
    for (const [name, tool] of [
      ['bg', 'tool-bg'],
      ['paper', 'tool-panel'],
      ['surface', 'tool-hover'],
      ['line', 'tool-line'],
      ['line-strong', 'tool-line-strong'],
      ['muted', 'tool-muted'],
      ['cobalt-soft', 'tool-selected'],
      ['charcoal', 'tool-stage'],
    ]) {
      expect(chrome, name).toMatch(new RegExp(`--${name}:\\s*var\\(--${tool}\\);`))
    }
  })

  test("the level sits in the mockup's near-black cabinet, darker than any panel line", () => {
    expect(hex('tool-stage')).toBe('#0e1014')
    expect(contrast('tool-panel', 'tool-stage')).toBeGreaterThan(15)
  })

  test('is 32 px dense with a mouse and keeps the touch rule wherever a finger may point', () => {
    // The mockup's density: rows and controls 32 px on a fine pointer that hovers, 44 (a primary 48) once any coarse
    // pointer is present, so a touch laptop or an iPad with a trackpad keeps finger-sized targets. The touch block
    // comes last, so it wins when both match.
    const mouse = chrome.indexOf('@media (hover: hover) and (pointer: fine)')
    const touch = chrome.indexOf('@media (any-pointer: coarse)')
    expect(mouse).toBeGreaterThan(-1)
    expect(touch).toBeGreaterThan(mouse)
    expect(chrome.slice(mouse, touch)).toMatch(/--size-hit:\s*32px;\s*--size-primary:\s*32px;/)
    expect(chrome.slice(touch)).toMatch(/--size-hit:\s*44px;\s*--size-primary:\s*48px;/)
  })

  test('every editor page loads it after the shared tokens', () => {
    for (const app of ['suite', 'design']) {
      const main = read(`src/app/${app}/main.ts`)
      expect(main.indexOf('tool-chrome.css'), app).toBeGreaterThan(main.indexOf('tokens.css'))
    }
  })

  test('its text reads: ink at 7:1 on the field, the greys at 4.5:1 on white and on the chosen row', () => {
    expect(contrast('ink', 'tool-bg')).toBeGreaterThanOrEqual(7)
    for (const grey of ['tool-muted', 'tool-faint']) {
      expect(contrast(grey, 'tool-panel'), grey).toBeGreaterThanOrEqual(4.5)
      expect(contrast(grey, 'tool-selected'), grey).toBeGreaterThanOrEqual(4.5)
    }
  })
})
