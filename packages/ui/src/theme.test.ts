import { describe, expect, test } from 'vitest'
import css from './theme.css?raw'

// The tokens are a contract (M1.6 spec §3.3): primitives read them, games override colours and
// type. Read as text, the way Ruken's theme test does, since jsdom does not compute custom properties.

/** The declarations inside the first rule whose selector is exactly `selector`. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`no rule for ${selector}`)
  return css.slice(start, css.indexOf('}', start))
}

const ENDESGA_64 = new Set(
  `ff0040 131313 1b1b1b 272727 3d3d3d 5d5d5d 858585 b4b4b4 ffffff c7cfdd 92a1b9 657392 424c6e 2a2f4e 1a1932 0e071b
  1c121c 391f21 5d2c28 8a4836 bf6f4a e69c69 f6ca9f f9e6cf edab50 e07438 c64524 8e251d ff5000 ed7614 ffa214 ffc825
  ffeb57 d3fc7e 99e65f 5ac54f 33984b 1e6f50 134c4c 0c2e44 00396d 0069aa 0098dc 00cdf9 0cf1ff 94fdff fdd2ed f389f5
  db3ffd 7a09fa 3003d9 0c0293 03193f 3b1443 622461 93388f ca52c9 c85086 f68187 f5555d ea323c c42430 891e2b 571c27`.split(
    /\s+/,
  ),
)

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
})
