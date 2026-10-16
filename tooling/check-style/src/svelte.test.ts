import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkSvelte } from './svelte.ts'

// QB.2: `{@html}` is forbidden in `ui`, and kits never draw the host's chrome, sign-in or payment UI (QB spec §4.1,
// §4.3; `ui` spec §3.11). No kit exists in core yet (PRODUCT.6 ships them in Automata Plus), so the rule is proven
// on these fixtures.
const FIXTURES = join(import.meta.dirname, 'testing', 'kit-fixtures')
const fixture = (name: string) => {
  const file = join(FIXTURES, name)
  return checkSvelte(file, readFileSync(file, 'utf8'))
}
const rulesAndLines = (name: string) => fixture(name).map((finding) => [finding.rule, finding.line])

describe('checkSvelte', () => {
  it('passes a kit screen that stays inside the frame, even when a comment names the host', () => {
    expect(fixture('clean-screen.svelte')).toEqual([])
  })

  it('finds {@html} with its line', () => {
    expect(rulesAndLines('html-tag.svelte')).toEqual([['no-html', 5]])
    expect(fixture('html-tag.svelte')[0]?.message).toContain('{@html}')
  })

  it('finds a sign-in form: the wording and the password field', () => {
    expect(rulesAndLines('login-mimic.svelte')).toEqual([
      ['platform-chrome', 6],
      ['platform-chrome', 8],
    ])
    expect(fixture('login-mimic.svelte').map((finding) => finding.message)).toEqual([
      'draws platform chrome: sign-in or payment wording ("Sign in")',
      'draws platform chrome: a password field (<input type="password">)',
    ])
  })

  it('finds a payment field by its autocomplete', () => {
    expect(fixture('payment-mimic.svelte').map((finding) => [finding.line, finding.message])).toEqual([
      [6, 'draws platform chrome: a card or credential field (autocomplete="cc-number")'],
    ])
  })

  it("finds the host's name written into a kit", () => {
    expect(fixture('host-name-mimic.svelte').map((finding) => [finding.line, finding.message])).toEqual([
      [2, `draws platform chrome: the host's name ("Ruken"); take it from hostName`],
    ])
  })

  it.each([
    ['a template literal', '<script>const t = `Log in`</script>', 1],
    ['an attribute value', '<input placeholder="Card number" />', 1],
    ['the one-time-code autocomplete', '<input autocomplete="one-time-code" />', 1],
    ['a script comment', '<script>\n// Checkout and Ruken are fine in a comment\n</script>', 0],
  ])('reads %s', (_what, code, count) => {
    expect(checkSvelte('/p/src/x.svelte', code).length).toBe(count)
  })

  it('reports a file it cannot parse', () => {
    expect(checkSvelte('/p/src/x.svelte', '<div>').map((finding) => finding.rule)).toEqual(['parse-error'])
  })
})
