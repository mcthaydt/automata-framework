import { describe, expect, test } from 'vitest'
import type { EditorTokens } from '#src/shared/kit/tokens/editor-tokens.ts'
import { tokensToCss } from '#src/shared/kit/tokens/tokens-to-css.ts'

const tokens: EditorTokens = {
  colorScheme: 'light',
  tokens: {
    bg: '#edf1ec',
    ink: '#11151c',
    glow: '0 0 0 3px rgb(203 242 92 / 0.22)',
    'size-hit': '44px',
  },
  aliases: { 'color-bg-app': 'bg', 'color-text-primary': 'ink' },
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
      /^\/\* Generated from src\/shared\/kit\/tokens\/tokens\.json by scripts\/generate-tokens\.ts/,
    )
  })

  test('puts every token on :root and declares the color scheme', () => {
    expect(css).toMatch(/^:root \{/m)
    expect(css).toContain('color-scheme: light;')
  })

  test('tokens become custom properties of the same name, values verbatim', () => {
    expect(vars.get('--bg')).toBe('#edf1ec')
    expect(vars.get('--glow')).toBe('0 0 0 3px rgb(203 242 92 / 0.22)')
    expect(vars.get('--size-hit')).toBe('44px')
  })

  test('aliases point at a token with var()', () => {
    expect(vars.get('--color-bg-app')).toBe('var(--bg)')
    expect(vars.get('--color-text-primary')).toBe('var(--ink)')
  })

  test('refuses an alias to a token that does not exist', () => {
    const broken: EditorTokens = { ...tokens, aliases: { 'color-bg-app': 'nowhere' } }
    expect(() => tokensToCss(broken)).toThrow(/alias "color-bg-app" points at "nowhere"/)
  })

  test('refuses a name that is both a token and an alias', () => {
    const twice: EditorTokens = { ...tokens, aliases: { bg: 'ink' } }
    expect(() => tokensToCss(twice)).toThrow(/"bg" is both a token and an alias/)
  })

  test('refuses a name that is not a plain custom property name', () => {
    const bad: EditorTokens = { ...tokens, tokens: { 'Not ok': '1px' }, aliases: {} }
    expect(() => tokensToCss(bad)).toThrow(/bad token name "Not ok"/)
  })

  test('is deterministic: the same tokens give the same text', () => {
    expect(tokensToCss(tokens)).toBe(css)
  })
})
