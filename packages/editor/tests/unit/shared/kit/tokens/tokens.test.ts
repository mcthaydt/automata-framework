import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import type { EditorTokens } from '#src/shared/kit/tokens/editor-tokens.ts'
import { tokensToCss } from '#src/shared/kit/tokens/tokens-to-css.ts'

const KIT = new URL('../../../../../src/shared/kit/', import.meta.url)
const read = (relative: string): string => readFileSync(new URL(relative, KIT), 'utf8')

// The design source of truth (tokens.json) and the two files built from it.
const tokens = JSON.parse(read('tokens/tokens.json')) as EditorTokens
const css = read('tokens.css')

function channel(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance of a `#rrggbb` color. */
function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return ((light as number) + 0.05) / ((dark as number) + 0.05)
}

describe('tokens.css', () => {
  test('equals the output for tokens.json (run `pnpm --filter @mcthaydt/automata-editor tokens` after editing the JSON)', () => {
    expect(css).toBe(tokensToCss(tokens))
  })

  test('says it is generated, so nobody edits it by hand', () => {
    expect(css).toMatch(/^\/\* Generated from src\/shared\/kit\/tokens\/tokens\.json/)
  })

  test('touch targets are 44 px and primary actions 48 px (the framework rule)', () => {
    expect(css).toContain('--size-hit: 44px;')
    expect(css).toContain('--size-primary: 48px;')
  })
})

describe('token contrast', () => {
  const color = (group: string, name: string): string => {
    const value = tokens.color[group]?.[name]
    if (value === undefined) throw new Error(`no color token ${group}.${name}`)
    return value
  }

  test('primary text on the app background reads at 7:1', () => {
    expect(contrast(color('text', 'primary'), color('bg', 'app'))).toBeGreaterThanOrEqual(7)
  })

  test('dim text on a surface reads at 4.5:1', () => {
    expect(contrast(color('text', 'dim'), color('bg', 'surface'))).toBeGreaterThanOrEqual(4.5)
  })

  test('ink on the accent fill reads at 4.5:1', () => {
    expect(contrast(color('accent', 'ink'), color('accent', 'default'))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('fonts.css', () => {
  const fonts = read('fonts.css')

  test('loads the Latin subset of IBM Plex Sans at 400, 500, 600 and 700', () => {
    for (const weight of [400, 500, 600, 700]) {
      expect(fonts).toContain(`@import "@fontsource/ibm-plex-sans/latin-${weight}.css";`)
    }
  })

  test('loads the Latin subset of IBM Plex Mono at 400, 500 and 600', () => {
    for (const weight of [400, 500, 600]) {
      expect(fonts).toContain(`@import "@fontsource/ibm-plex-mono/latin-${weight}.css";`)
    }
  })
})
