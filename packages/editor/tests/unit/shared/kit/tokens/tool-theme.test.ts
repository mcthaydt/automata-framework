import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { contrast } from '#src/shared/kit/tokens/contrast.ts'
import type { EditorTokens, ToolTheme } from '#src/shared/kit/tokens/editor-tokens.ts'
import { toolThemeToCss } from '#src/shared/kit/tokens/tool-theme-to-css.ts'

// The editors' second look. `tool-theme.json` holds each colour twice; `tool-theme.css` is generated from it. The
// contrast tests read the JSON, so they check the values that ship.
const PACKAGE = new URL('../../../../../', import.meta.url)
const read = (relative: string): string => readFileSync(new URL(relative, PACKAGE), 'utf8')
const theme = JSON.parse(read('src/shared/kit/tokens/tool-theme.json')) as ToolTheme
const shared = (JSON.parse(read('src/shared/kit/tokens/tokens.json')) as EditorTokens).tokens
const css = read('src/shared/kit/tool-theme.css')

const LOOKS = ['light', 'dark'] as const
const at = (look: (typeof LOOKS)[number], name: string): string => {
  const value = theme[look][name]
  if (value === undefined) throw new Error(`${look} has no ${name}`)
  return value
}
// A token that is the same in both looks lives in tokens.json (the website's names), not in the theme.
const fixed = (name: string): string => {
  const value = shared[name]
  if (value === undefined) throw new Error(`tokens.json has no ${name}`)
  return value
}

describe('tool-theme.css', () => {
  test('equals the output for tool-theme.json (run `pnpm --filter @automata/editor tokens` after editing the JSON)', () => {
    expect(css).toBe(toolThemeToCss(theme))
  })

  test('has the same names in both looks', () => {
    expect(Object.keys(theme.dark).sort()).toEqual(Object.keys(theme.light).sort())
  })

  test("the light values are today's", () => {
    const today: Record<string, string> = {
      'tool-bg': '#f7f7f8',
      'tool-panel': '#ffffff',
      'tool-hover': '#f2f2f4',
      'tool-selected': '#eceef8',
      'tool-line': '#e7e7ea',
      'tool-line-strong': '#d4d4d8',
      'tool-muted': '#5f5f6a',
      'tool-faint': '#6b6b76',
      'tool-stage': '#0e1014',
      ink: '#11151c',
      cobalt: '#1d278a',
      ok: '#1e6b34',
      bad: '#b42318',
      warn: '#8a5300',
      'danger-wash': 'rgb(180 35 24 / 0.08)',
      scrim: 'rgb(17 21 28 / 0.32)',
      'shadow-lift': 'rgb(17 21 28 / 0.06)',
      'shadow-ink': 'rgb(17 21 28 / 0.12)',
      'shadow-ring': 'rgb(17 21 28 / 0.1)',
      'on-lime': '#11151c',
      'primary-edge': '#11151c',
    }
    for (const [name, value] of Object.entries(today)) expect(at('light', name), name).toBe(value)
    // Where the website's token file already names it, the light value is that one.
    for (const name of Object.keys(theme.light)) {
      const site = shared[name]
      if (site !== undefined && /^(#|rgb)/.test(site)) expect(at('light', name), name).toBe(site)
    }
  })

  test('never uses light-dark(), which a canvas reading a token as text could not resolve', () => {
    expect(css).not.toContain('light-dark(')
  })

  test('the game keeps its colours: no canvas palette in the theme', () => {
    for (const look of LOOKS) {
      for (const name of Object.keys(theme[look])) expect(name).not.toMatch(/^color-(layer|phase)-/)
    }
  })

  test('the cabinet does not change, and is darker than the dark field', () => {
    expect(at('dark', 'tool-stage')).toBe(at('light', 'tool-stage'))
    expect(contrast(at('dark', 'tool-bg'), at('dark', 'tool-stage'))).toBeGreaterThan(1)
    expect(at('dark', 'tool-stage')).toBe('#0e1014')
  })

  test.each(LOOKS)('words read in %s', (look) => {
    for (const fg of ['ink', 'tool-muted', 'tool-faint', 'cobalt', 'ok', 'bad', 'warn']) {
      for (const bg of ['tool-bg', 'tool-panel', 'tool-hover', 'tool-selected']) {
        expect(contrast(at(look, fg), at(look, bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  test.each(LOOKS)('words on a colour read in %s', (look) => {
    expect(contrast(at(look, 'on-lime'), fixed('lime')), 'on-lime on lime').toBeGreaterThanOrEqual(4.5)
    expect(contrast(at(look, 'on-accent'), at(look, 'cobalt')), 'on-accent on cobalt').toBeGreaterThanOrEqual(
      4.5,
    )
  })

  test.each(LOOKS)('the focus ring shows in %s', (look) => {
    for (const bg of ['tool-bg', 'tool-panel']) {
      expect(contrast(at(look, 'cobalt'), at(look, bg)), `focus on ${bg}`).toBeGreaterThanOrEqual(3)
    }
  })

  test('words on the cabinet read, in both looks (the cabinet is fixed)', () => {
    for (const name of ['stage-ink', 'stage-muted']) {
      expect(contrast(fixed(name), at('light', 'tool-stage')), name).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('control edges show in dark at least as well as in light', () => {
    const edge = (look: (typeof LOOKS)[number]): number =>
      contrast(at(look, 'tool-line-strong'), at(look, 'tool-panel'))
    expect(edge('dark')).toBeGreaterThanOrEqual(edge('light'))
  })

  test('the lime button keeps an edge that shows on the field in both looks', () => {
    for (const look of LOOKS) {
      expect(contrast(at(look, 'primary-edge'), at(look, 'tool-bg')), look).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('tool-chrome.css', () => {
  const chrome = read('src/shared/kit/tool-chrome.css').replace(/\/\*[\s\S]*?\*\//g, '')

  test('imports the theme first and builds the words-on-colour and shadow tokens from it', () => {
    expect(chrome.trimStart().startsWith('@import "./tool-theme.css";')).toBe(true)
    expect(chrome).toMatch(/--primary-ink:\s*var\(--on-lime\);/)
    expect(chrome).toMatch(/--color-accent-ink:\s*var\(--on-accent\);/)
    expect(chrome).toMatch(/--primary-hover:\s*color-mix\(in oklab, var\(--lime\) 86%, var\(--on-lime\)\);/)
    expect(chrome).toMatch(/--shadow:\s*0 1px 2px var\(--shadow-lift\);/)
    expect(chrome).toMatch(
      /--shadow-sheet:\s*0 0 0 1px var\(--shadow-ring\), 0 12px 32px var\(--shadow-ink\);/,
    )
  })
})

describe('toolThemeToCss', () => {
  const ok: ToolTheme = { light: { 'tool-bg': '#ffffff' }, dark: { 'tool-bg': '#000000' } }

  test('writes light on :root, dark for a dark device and for a forced dark choice', () => {
    const out = toolThemeToCss(ok)
    expect(out).toContain(':root {\n  color-scheme: light dark;\n  --tool-bg: #ffffff;\n}')
    expect(out).toContain(
      '@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n    color-scheme: dark;\n    --tool-bg: #000000;',
    )
    expect(out).toContain(':root[data-theme="light"] {\n  color-scheme: light;\n}')
    expect(out).toContain(':root[data-theme="dark"] {\n  color-scheme: dark;\n  --tool-bg: #000000;\n}')
  })

  test('refuses a key in one look and not the other', () => {
    expect(() =>
      toolThemeToCss({ light: { 'tool-bg': '#fff000', x: '#ffffff' }, dark: { 'tool-bg': '#000000' } }),
    ).toThrow(/x/)
  })

  test('refuses a bad name', () => {
    expect(() => toolThemeToCss({ light: { Bad_Name: '#ffffff' }, dark: { Bad_Name: '#000000' } })).toThrow(
      /Bad_Name/,
    )
  })

  test('refuses a value that is not a colour (a shadow or a mix never lands in the theme)', () => {
    expect(() =>
      toolThemeToCss({ light: { shadow: '0 1px 2px red' }, dark: { shadow: '0 1px 2px red' } }),
    ).toThrow(/shadow/)
  })
})

describe('contrast', () => {
  test('is the WCAG ratio', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#ffffff', '#ffffff')).toBe(1)
  })

  test('composites an rgb() colour with alpha over the background first', () => {
    // 50% black over white is #808080-ish: far below black on white and above white on white.
    const ratio = contrast('rgb(0 0 0 / 0.5)', '#ffffff')
    expect(ratio).toBeGreaterThan(3)
    expect(ratio).toBeLessThan(21)
  })
})
