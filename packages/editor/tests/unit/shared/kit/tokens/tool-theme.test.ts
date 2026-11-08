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

  // Spec §4's table, key by key: the editors' v2 palette (site v2's), in both looks.
  const V2: Record<(typeof LOOKS)[number], Record<string, string>> = {
    dark: {
      'tool-bg': '#0b0c0e',
      'tool-panel': '#111316',
      'tool-raise': '#181b20',
      'tool-hover': '#1b1e23',
      'tool-selected': '#1c2333',
      'tool-line': '#22252b',
      'tool-line-strong': '#33373e',
      'tool-line-hover': '#4a4f58',
      ink: '#f2f3f5',
      'tool-muted': '#a6abb3',
      'tool-faint': '#8f959e',
      cobalt: '#8ea2ff',
      warn: '#f5b14c',
      bad: '#ff7a6e',
      ok: '#6fd08c',
      'lime-hover': '#d8f77d',
      'on-lime': '#11151c',
      'tool-stage': '#08090b',
      'tool-dot': '#1d2026',
    },
    light: {
      'tool-bg': '#f4f4f5',
      'tool-panel': '#ffffff',
      'tool-raise': '#f7f7f8',
      'tool-hover': '#f0f0f2',
      'tool-selected': '#eceef8',
      'tool-line': '#e7e7ea',
      'tool-line-strong': '#d4d4d8',
      'tool-line-hover': '#a1a1aa',
      ink: '#18181b',
      'tool-muted': '#5f5f6a',
      'tool-faint': '#6b6b76',
      cobalt: '#1d278a',
      warn: '#8a5300',
      bad: '#b42318',
      ok: '#1e6b34',
      'lime-hover': '#d8f77d',
      'on-lime': '#11151c',
      'tool-stage': '#08090b',
      'tool-dot': '#1d2026',
    },
  }

  test.each(LOOKS)('the %s values are the v2 palette', (look) => {
    for (const [name, value] of Object.entries(V2[look])) expect(at(look, name), name).toBe(value)
  })

  test('every key the file held before v2 is still there', () => {
    for (const name of [
      'stage-warn',
      'danger-wash',
      'scrim',
      'shadow-ink',
      'shadow-ring',
      'shadow-lift',
      'on-accent',
      'primary-edge',
    ]) {
      expect(theme.light[name], `light ${name}`).toBeDefined()
      expect(theme.dark[name], `dark ${name}`).toBeDefined()
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

  test('the cabinet is the same in both looks, and as dark as the dark window or darker', () => {
    expect(at('dark', 'tool-stage')).toBe(at('light', 'tool-stage'))
    expect(at('dark', 'tool-stage')).toBe('#08090b')
  })

  // Spec §4's Contrast paragraph: one test per pair, so a failure names it.
  const WORDS = ['ink', 'tool-muted', 'tool-faint']
  const SURFACES = ['tool-panel', 'tool-raise', 'tool-hover', 'tool-selected']
  const SIGNS = ['warn', 'bad', 'ok', 'cobalt']
  const BACKS = ['tool-panel', 'tool-raise']
  for (const look of LOOKS) {
    for (const fg of WORDS) {
      for (const bg of SURFACES) {
        test(`${fg} on ${bg}, ${look}`, () => {
          expect(contrast(at(look, fg), at(look, bg))).toBeGreaterThanOrEqual(4.5)
        })
      }
    }
    for (const fg of SIGNS) {
      for (const bg of BACKS) {
        test(`${fg} on ${bg}, ${look}`, () => {
          expect(contrast(at(look, fg), at(look, bg))).toBeGreaterThanOrEqual(4.5)
        })
      }
    }
    test(`tool-faint on tool-bg, ${look}`, () => {
      expect(contrast(at(look, 'tool-faint'), at(look, 'tool-bg'))).toBeGreaterThanOrEqual(4.5)
    })
    test(`on-lime on lime-hover, ${look}`, () => {
      expect(contrast(at(look, 'on-lime'), at(look, 'lime-hover'))).toBeGreaterThanOrEqual(4.5)
    })
  }

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
    for (const look of LOOKS) {
      expect(at(look, 'stage-warn'), look).toBe(at('light', 'stage-warn'))
      expect(
        contrast(at(look, 'stage-warn'), at(look, 'tool-stage')),
        `stage-warn in ${look}`,
      ).toBeGreaterThanOrEqual(4.5)
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
    expect(chrome).toMatch(/--primary-hover:\s*var\(--lime-hover\);/)
    expect(chrome).toMatch(/--shadow:\s*0 1px 2px var\(--shadow-lift\);/)
    expect(chrome).toMatch(
      /--shadow-sheet:\s*0 0 0 1px var\(--shadow-ring\), 0 12px 32px var\(--shadow-ink\);/,
    )
  })
})

describe('toolThemeToCss', () => {
  const ok: ToolTheme = { light: { 'tool-bg': '#ffffff' }, dark: { 'tool-bg': '#000000' } }

  test("writes dark on :root as the default, light when the page says so, and the device's look for Match device", () => {
    const out = toolThemeToCss(ok)
    expect(out).toContain(':root {\n  color-scheme: dark;\n  --tool-bg: #000000;\n}')
    expect(out).toContain(':root[data-theme="light"] {\n  color-scheme: light;\n  --tool-bg: #ffffff;\n}')
    expect(out).toContain(
      '@media (prefers-color-scheme: light) {\n  :root[data-theme="device"] {\n    color-scheme: light;\n    --tool-bg: #ffffff;\n  }\n}',
    )
    expect(out).not.toContain('prefers-color-scheme: dark')
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
