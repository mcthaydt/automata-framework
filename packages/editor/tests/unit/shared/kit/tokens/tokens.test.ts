import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import type { EditorTokens } from '#src/shared/kit/tokens/editor-tokens.ts'
import { tokensToCss } from '#src/shared/kit/tokens/tokens-to-css.ts'

const PACKAGE = new URL('../../../../../', import.meta.url)
const read = (relative: string): string => readFileSync(new URL(relative, PACKAGE), 'utf8')

// The one source of truth (tokens.json) and the file built from it, which the editor and the site both import.
const tokens = JSON.parse(read('src/shared/kit/tokens/tokens.json')) as EditorTokens
const css = read('src/shared/kit/tokens.css')

/** `--name: value;` declarations of a CSS text, comments dropped and whitespace collapsed, by name. */
function declarations(text: string): Map<string, string> {
  const flat = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
  const found = new Map<string, string>()
  for (const [, name, value] of flat.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    found.set(name as string, (value as string).trim())
  }
  return found
}

const vars = declarations(css)

describe('tokens.css', () => {
  test('equals the output for tokens.json (run `pnpm --filter @mcthaydt/automata-editor tokens` after editing the JSON)', () => {
    expect(css).toBe(tokensToCss(tokens))
  })

  test('the generator`s --check passes on the tree and says how to fix a stale file', () => {
    const script = fileURLToPath(new URL('scripts/generate-tokens.ts', PACKAGE))
    const run = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' })
    expect(run.status, run.stderr).toBe(0)
  })

  test('says it is generated, so nobody edits it by hand', () => {
    expect(css).toMatch(/^\/\* Generated from src\/shared\/kit\/tokens\/tokens\.json/)
  })

  test('is a light theme, the website`s', () => {
    expect(css).toContain('color-scheme: light;')
  })

  test('defines every custom property the website`s :root defined, with the same value', () => {
    const site = declarations(read('tests/fixtures/tokens/site-root.css'))
    expect(site.size).toBeGreaterThanOrEqual(36)
    for (const [name, value] of site) expect(vars.get(name), name).toBe(value)
  })

  test('every old editor colour name is an alias, except the layer and phase colours projects and charts read', () => {
    const old = [
      '--color-bg-app',
      '--color-bg-surface',
      '--color-bg-raised',
      '--color-bg-field',
      '--color-bg-canvas',
      '--color-border-default',
      '--color-border-strong',
      '--color-text-primary',
      '--color-text-dim',
      '--color-text-faint',
      '--color-accent-default',
      '--color-accent-ink',
      '--color-accent-soft',
      '--color-state-ok',
      '--color-state-bad',
      '--color-state-warn',
    ]
    for (const name of old) expect(vars.get(name), name).toMatch(/^var\(--[\w-]+\)$/)
    for (const layer of ['sky', 'city', 'tiles', 'entities', 'intgrid']) {
      expect(vars.get(`--color-layer-${layer}`), layer).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  test('touch targets are 44 px and primary actions 48 px (the framework rule)', () => {
    expect(vars.get('--size-hit')).toBe('44px')
    expect(vars.get('--size-primary')).toBe('48px')
  })
})

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

describe('token contrast', () => {
  const color = (name: string): string => {
    const value = tokens.tokens[name]
    if (value === undefined || !/^#[0-9a-f]{6}$/.test(value)) throw new Error(`no hex token ${name}`)
    return value
  }

  test('ink on the field reads at 7:1', () => {
    expect(contrast(color('ink'), color('bg'))).toBeGreaterThanOrEqual(7)
  })

  test('muted text on paper reads at 4.5:1', () => {
    expect(contrast(color('muted'), color('paper'))).toBeGreaterThanOrEqual(4.5)
  })

  test('light ink on cobalt reads at 4.5:1', () => {
    expect(contrast(color('stage-ink'), color('cobalt'))).toBeGreaterThanOrEqual(4.5)
  })

  test('ink on the chartreuse primary reads at 4.5:1', () => {
    expect(contrast(color('ink'), color('lime'))).toBeGreaterThanOrEqual(4.5)
  })

  test('the state colours read as text on paper at 4.5:1', () => {
    for (const state of ['ok', 'bad', 'warn']) {
      expect(contrast(color(state), color('paper')), state).toBeGreaterThanOrEqual(4.5)
    }
  })
})
