import { describe, expect, test } from 'vitest'
import palette from '../../../docs/art/palettes/endesga-64.txt?raw'
import css from './theme.css?raw'

// The tokens are a contract (M1.6 spec §3.3): primitives read them, games override colours and
// type. Read as text, the way Ruken's theme test does, since jsdom does not compute custom properties.

/** The declarations inside the first rule whose selector is exactly `selector`. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`no rule for ${selector}`)
  return css.slice(start, css.indexOf('}', start))
}

// The palette file exactly as the Owner supplied it (paint.net AARRGGBB lines, `;` comments).
const ENDESGA_64 = new Set(
  palette
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith(';'))
    .map((line) => line.slice(2).toLowerCase()),
)

/** The colour a token is set to in `:root`. */
function colour(token: string): string {
  const match = new RegExp(`${token}: #([0-9a-f]{6});`).exec(block(':root'))
  if (match?.[1] === undefined) throw new Error(`${token} is not a hex colour`)
  return match[1]
}

/** WCAG 2 relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

describe('theme.css', () => {
  test('defines every token the primitives read', () => {
    const root = block(':root')
    for (const token of [
      '--af-target',
      '--af-target-primary',
      '--af-gutter',
      '--af-row-h',
      '--af-ring-room',
      '--af-text-body',
      '--af-text-small',
      '--af-surface',
      '--af-panel',
      '--af-ink',
      '--af-muted',
      '--af-accent',
      '--af-on-accent',
      '--af-danger',
      '--af-on-danger',
      '--af-danger-edge',
      '--af-success',
      '--af-ring',
      '--af-scrim',
      '--af-edge',
    ]) {
      expect(root, token).toContain(`${token}:`)
    }
  })

  test('targets are 44 and 48 px, enlarged by the host scale and never by zoom', () => {
    const root = block(':root')
    expect(root).toContain('--af-target: calc(44px * var(--af-scale, 1))')
    expect(root).toContain('--af-target-primary: calc(48px * var(--af-scale, 1))')
    expect(css).not.toMatch(/\bzoom\s*:/)
  })

  test('a primary is sized by data-kind="primary", the one marker the layout check reads', () => {
    expect(block('.af-control[data-kind="primary"]')).toContain('min-height: var(--af-target-primary)')
    expect(block('.af-control--primary')).not.toContain('min-height')
  })

  test('short and compact screens tighten the gutter and never the targets', () => {
    for (const selector of [':root[data-height="short"]', ':root[data-height="compact"]']) {
      const rule = block(selector)
      expect(rule).toContain('--af-gutter:')
      expect(rule).not.toContain('--af-target')
    }
  })

  test('every colour is from the Endesga 64 palette (art direction, 2026-10-11)', () => {
    const hexes = [...css.matchAll(/#([0-9a-fA-F]{6})\b/g)].map((m) => (m[1] ?? '').toLowerCase())
    expect(hexes.length).toBeGreaterThan(0)
    for (const hex of hexes) expect(ENDESGA_64.has(hex), `#${hex}`).toBe(true)
  })

  test.each([
    ['--af-ink', '--af-surface', 4.5],
    ['--af-ink', '--af-panel', 4.5],
    ['--af-muted', '--af-surface', 4.5],
    ['--af-muted', '--af-panel', 4.5],
    ['--af-on-accent', '--af-accent', 4.5],
    ['--af-on-danger', '--af-danger', 4.5],
    ['--af-ring', '--af-surface', 3],
    ['--af-ring', '--af-panel', 3],
    ['--af-edge', '--af-surface', 3],
    ['--af-edge', '--af-panel', 3],
    ['--af-accent', '--af-surface', 3],
    ['--af-accent', '--af-panel', 3],
    ['--af-danger-edge', '--af-surface', 3],
    ['--af-danger-edge', '--af-panel', 3],
    ['--af-success', '--af-surface', 3],
    ['--af-success', '--af-panel', 3],
  ])('%s on %s meets %d:1', (fore, back, minimum) => {
    expect(contrast(colour(fore), colour(back))).toBeGreaterThanOrEqual(minimum)
  })
})

// A double tap must not zoom the page (the Owner, on a real iPad): the page carries `manipulation`, and the one place a
// game's canvas wants every gesture (`touch-action: none`) says so on itself.
describe('touch', () => {
  test('the page ends double-tap zoom', () => {
    expect(css).toMatch(/html,\s*body\s*\{[^}]*touch-action: manipulation/)
  })
  test('a typed field still selects', () => {
    expect(css).toMatch(/input,\s*textarea\s*\{[^}]*user-select: text/)
  })
})
