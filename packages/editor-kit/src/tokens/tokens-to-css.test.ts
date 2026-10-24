import { describe, expect, test } from 'vitest'
import type { EditorTokens } from './editor-tokens'
import { tokensToCss } from './tokens-to-css'

const tokens: EditorTokens = {
  color: {
    bg: { app: '#111214', surface: '#1a1b1e' },
    accent: { default: '#e0a54a', soft: 'rgba(224, 165, 74, 0.16)' },
  },
  space: { '1': 4, '4': 16 },
  radius: { sm: 6 },
  size: { hit: 44, primary: 48 },
  font: {
    sans: 'IBM Plex Sans',
    mono: 'IBM Plex Mono',
    ramp: {
      'body-13': { family: 'sans', weight: 400, size: 13, line: 18, tracking: 0 },
      'eyebrow-11': { family: 'sans', weight: 600, size: 11, line: 14, tracking: 0.9 },
      'mono-12': { family: 'mono', weight: 400, size: 12, line: 16, tracking: 0 },
    },
  },
}

/** Every `--name: value;` line inside the `:root` block, by name. */
function declarations(css: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const [, name, value] of css.matchAll(/^\s*(--[\w-]+):\s*(.+);$/gm)) {
    found.set(name as string, value as string)
  }
  return found
}

describe('tokensToCss', () => {
  const css = tokensToCss(tokens)
  const vars = declarations(css)

  test('starts with a do-not-edit header naming the source', () => {
    expect(css).toMatch(
      /^\/\* Generated from docs\/design\/editor-kit\/tokens\.json by scripts\/generate-tokens\.ts/,
    )
  })

  test('puts every token on :root and declares the dark color scheme', () => {
    expect(css).toMatch(/^:root \{/m)
    expect(css).toContain('color-scheme: dark;')
  })

  test('colors become --color-<group>-<name>, verbatim', () => {
    expect(vars.get('--color-bg-app')).toBe('#111214')
    expect(vars.get('--color-bg-surface')).toBe('#1a1b1e')
    expect(vars.get('--color-accent-default')).toBe('#e0a54a')
    expect(vars.get('--color-accent-soft')).toBe('rgba(224, 165, 74, 0.16)')
  })

  test('space, radius and size are px lengths', () => {
    expect(vars.get('--space-1')).toBe('4px')
    expect(vars.get('--space-4')).toBe('16px')
    expect(vars.get('--radius-sm')).toBe('6px')
    expect(vars.get('--size-hit')).toBe('44px')
    expect(vars.get('--size-primary')).toBe('48px')
  })

  test('font families keep a system fallback stack', () => {
    expect(vars.get('--font-sans')).toMatch(/^"IBM Plex Sans", .*sans-serif$/)
    expect(vars.get('--font-mono')).toMatch(/^"IBM Plex Mono", .*monospace$/)
  })

  test('each ramp entry has a font shorthand and a tracking value', () => {
    expect(vars.get('--text-body-13')).toBe('400 13px / 18px var(--font-sans)')
    expect(vars.get('--text-body-13-tracking')).toBe('0px')
    expect(vars.get('--text-eyebrow-11')).toBe('600 11px / 14px var(--font-sans)')
    expect(vars.get('--text-eyebrow-11-tracking')).toBe('0.9px')
    expect(vars.get('--text-mono-12')).toBe('400 12px / 16px var(--font-mono)')
  })

  test('is deterministic: the same tokens give the same text', () => {
    expect(tokensToCss(tokens)).toBe(css)
  })

  test('refuses a token group it does not know how to render', () => {
    const withShadow = { ...tokens, shadow: { card: '0 1px 2px #000' } } as unknown as EditorTokens
    expect(() => tokensToCss(withShadow)).toThrow(/unknown token group "shadow"/)
  })

  test('ignores the $comment note', () => {
    const noted = { $comment: 'source of truth', ...tokens } as unknown as EditorTokens
    expect(() => tokensToCss(noted)).not.toThrow()
  })
})
