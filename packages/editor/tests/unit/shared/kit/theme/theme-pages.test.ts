import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { THEME_BOOT } from '#src/shared/kit/theme/theme-choice.ts'

// Every editor page sets the look before anything paints. The script is a file beside the page, not inline: the site
// serves the 2D editor at /editor/app/ under `script-src 'self'` (DEMO_POLICY), which refuses an inline script, and
// the try-it editor would flash light. Each package keeps a copy in `public/`; this pins them to one text.
const REPO = new URL('../../../../../../../', import.meta.url)
const read = (relative: string): string => readFileSync(new URL(relative, REPO), 'utf8')

const PAGES = [
  'packages/editor/index.html',
  'packages/editor/suite.html',
  'packages/editor/design.html',
  'packages/editor-3d/index.html',
  'packages/editor-3d/suite.html',
  'extensions/editors/suite.html',
]
const COPIES = ['packages/editor', 'packages/editor-3d', 'extensions/editors'].map(
  (p) => `${p}/public/theme-boot.js`,
)

describe.each(PAGES)('%s', (page) => {
  const html = read(page)
  const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'))

  test('loads ./theme-boot.js as a classic script before any stylesheet or module', () => {
    const boot = head.indexOf('<script src="./theme-boot.js"></script>')
    expect(boot).toBeGreaterThan(-1)
    for (const later of ['<link', 'type="module"']) {
      const at = html.indexOf(later)
      if (at !== -1) expect(boot, later).toBeLessThan(at)
    }
  })

  test('has no inline script', () => {
    for (const [, attributes, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      expect(attributes, 'a script with a body').toMatch(/\bsrc=/)
      expect(body?.trim(), 'a script with a body').toBe('')
    }
  })

  test('says it is made for light and dark', () => {
    expect(html).toContain('<meta name="color-scheme" content="light dark" />')
  })
})

describe.each(COPIES)('%s', (copy) => {
  test('is exactly THEME_BOOT', () => {
    expect(read(copy)).toBe(THEME_BOOT)
  })
})
